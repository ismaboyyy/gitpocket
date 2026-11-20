use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::sync::Mutex;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{ipc::Channel, AppHandle, Manager, State};

#[derive(Deserialize, Clone, Default)]
struct Owner {
    avatar_url: Option<String>,
}

#[derive(Deserialize, Clone)]
struct Raw {
    #[serde(default)]
    owner: Owner,
    id: u64,
    full_name: String,
    description: Option<String>,
    private: bool,
    language: Option<String>,
    updated_at: Option<String>,
    pushed_at: Option<String>,
    archived: bool,
}

#[derive(Serialize)]
struct Repo {
    id: u64,
    full_name: String,
    description: Option<String>,
    private: bool,
    language: Option<String>,
    updated_at: Option<String>,
    pushed_at: Option<String>,
    archived: bool,
    collaborator: bool,
    invited_at: Option<String>,
    open_prs: Option<u64>,
    local_path: Option<String>,
    avatar_url: Option<String>,
    icon: Option<String>,
}

#[derive(Deserialize)]
struct Invitation {
    created_at: String,
    repository: Raw,
}

#[derive(Serialize)]
struct Overview {
    login: String,
    clone_dir: String,
    repos: Vec<Repo>,
    invitations: Vec<Repo>,
    warning: Option<String>,
}

// Tokens stay managed by GitHub CLI: the app stores none.
fn gh_json(args: &[&str], paginate: bool) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("gh");
    cmd.args(["api", "--hostname", "github.com"]).args(args);
    if paginate {
        cmd.args(["--paginate", "--slurp"]);
    }
    let out = cmd.output().map_err(|_| "GitHub CLI (gh) not found. Install it, then run `gh auth login --hostname github.com`.".to_string())?;
    if !out.status.success() {
        return Err("Could not load GitHub. Check your Internet connection and run `gh auth login --hostname github.com`. Also check your organization's permissions and SSO.".into());
    }
    let value: serde_json::Value = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
    Ok(match (paginate, value) {
        // --slurp returns an array of pages: flatten it.
        (true, serde_json::Value::Array(pages)) => serde_json::Value::Array(
            pages.into_iter().flat_map(|p| match p { serde_json::Value::Array(a) => a, o => vec![o] }).collect(),
        ),
        (_, v) => v,
    })
}

fn gh<T: for<'a> Deserialize<'a>>(endpoint: &str, paginate: bool) -> Result<T, String> {
    serde_json::from_value(gh_json(&[endpoint], paginate)?).map_err(|e| e.to_string())
}

// Open pull request counts are only available through GraphQL.
fn open_prs() -> Result<HashMap<String, u64>, String> {
    let query = "query($endCursor: String) { viewer { repositories(first: 100, after: $endCursor, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) { pageInfo { hasNextPage endCursor } nodes { nameWithOwner pullRequests(states: OPEN) { totalCount } } } } }";
    let pages = gh_json(&["graphql", "-f", &format!("query={query}")], true)?;
    let nodes = pages.as_array().into_iter().flatten().filter_map(|p| p["data"]["viewer"]["repositories"]["nodes"].as_array()).flatten();
    Ok(nodes.filter_map(|n| Some((n["nameWithOwner"].as_str()?.to_lowercase(), n["pullRequests"]["totalCount"].as_u64()?))).collect())
}

fn repo(r: Raw, collaborator: bool, invited_at: Option<String>, open_prs: Option<u64>) -> Repo {
    let avatar_url = r.owner.avatar_url.clone();
    Repo { id: r.id, full_name: r.full_name, description: r.description, private: r.private, language: r.language, updated_at: r.updated_at, pushed_at: r.pushed_at, archived: r.archived, collaborator, invited_at, open_prs, local_path: None, avatar_url, icon: None }
}

#[derive(Serialize, Deserialize, Default)]
struct Settings {
    clone_dir: Option<PathBuf>,
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join("settings.json"))
}

fn clone_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let saved = std::fs::read(settings_file(app)?).ok().and_then(|b| serde_json::from_slice::<Settings>(&b).ok()).and_then(|s| s.clone_dir);
    match saved {
        Some(dir) => Ok(dir),
        None => Ok(app.path().home_dir().map_err(|e| e.to_string())?.join("Projects")),
    }
}

#[tauri::command]
fn set_clone_dir(app: AppHandle, dir: String) -> Result<(), String> {
    let file = settings_file(&app)?;
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_vec(&Settings { clone_dir: Some(dir.into()) }).map_err(|e| e.to_string())?;
    std::fs::write(file, json).map_err(|e| e.to_string())
}

// Maps lowercase "owner/name" to the local folder, by reading each repository's git origin.
// A folder with a .git stops the descent (nested repos are ignored); depth is capped to keep the scan fast.
fn find_local(dir: &Path) -> HashMap<String, String> {
    fn walk(dir: &Path, depth: u8, found: &mut HashMap<String, String>) {
        for entry in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !path.is_dir() || name.starts_with('.') || ["node_modules", "target"].contains(&&*name) {
                continue;
            }
            match std::fs::read_to_string(path.join(".git/config")) {
                Ok(config) => {
                    for line in config.lines() {
                        let Some((key, url)) = line.split_once('=') else { continue };
                        if key.trim() != "url" { continue }
                        if let Some((_, rest)) = url.trim().split_once("github.com") {
                            let repo = rest.trim_start_matches([':', '/']).trim_end_matches('/').trim_end_matches(".git");
                            found.entry(repo.to_lowercase()).or_insert_with(|| path.to_string_lossy().into_owned());
                        }
                    }
                }
                Err(_) if depth > 1 && !path.join(".git").exists() => walk(&path, depth - 1, found),
                Err(_) => {}
            }
        }
    }
    let mut found = HashMap::new();
    walk(dir, 4, &mut found);
    found
}

// Looks for a logo in a cloned repository and returns it as a data URL.
// shortcut: fixed list of common locations, upgrade to reading the manifest (package.json, Cargo.toml) if misses are common.
fn find_icon(repo: &Path) -> Option<String> {
    use base64::{Engine, engine::general_purpose::STANDARD};
    const DIRS: &[&str] = &["", "assets", "public", "static", "docs", ".github", "src-tauri/icons", "app/src/main/res/mipmap-xxxhdpi"];
    const FILES: &[&str] = &["icon.svg", "logo.svg", "favicon.svg", "icon.png", "logo.png", "128x128.png", "favicon.png", "ic_launcher.png", "favicon.ico"];
    for dir in DIRS {
        for file in FILES {
            let path = repo.join(dir).join(file);
            let Ok(meta) = std::fs::metadata(&path) else { continue };
            if !meta.is_file() || meta.len() > 256 * 1024 { continue }
            let mime = match path.extension()?.to_str()? {
                "svg" => "image/svg+xml",
                "png" => "image/png",
                _ => "image/x-icon",
            };
            if let Ok(bytes) = std::fs::read(&path) {
                return Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)));
            }
        }
    }
    None
}

#[tauri::command]
fn repo_icon(path: String) -> Option<String> {
    find_icon(Path::new(&path))
}

fn split_repo(full_name: &str) -> Result<(&str, &str), String> {
    let valid = |part: &str| !part.is_empty() && part.chars().any(|c| c != '.') && part.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c));
    match full_name.split_once('/') {
        Some((owner, name)) if valid(owner) && valid(name) => Ok((owner, name)),
        _ => Err("Invalid repository name.".into()),
    }
}

#[derive(Serialize)]
struct Detail {
    default_branch: String,
    readme: Option<String>,
    readme_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct Entry {
    name: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    size: u64,
}

#[tauri::command]
async fn repo_detail(full_name: String, branch: Option<String>) -> Result<Detail, String> {
    split_repo(&full_name)?;
    let query = ref_query(&branch)?;
    tauri::async_runtime::spawn_blocking(move || {
        use base64::{Engine, engine::general_purpose::STANDARD};
        #[derive(Deserialize)]
        struct Info { default_branch: String }
        #[derive(Deserialize)]
        struct Readme { content: String, path: String }
        let info: Info = gh(&format!("repos/{full_name}"), false)?;
        // A repository without README is normal: ignore that error.
        let readme: Option<Readme> = gh(&format!("repos/{full_name}/readme{query}"), false).ok();
        let text = readme.as_ref().and_then(|r| {
            let compact: String = r.content.chars().filter(|c| !c.is_whitespace()).collect();
            STANDARD.decode(compact).ok().map(|b| String::from_utf8_lossy(&b).into_owned())
        });
        Ok(Detail { default_branch: info.default_branch, readme: text, readme_path: readme.map(|r| r.path) })
    })
    .await
    .map_err(|e| e.to_string())?
}

// Builds the `?ref=` query for a branch name, rejecting anything that could alter the request.
fn ref_query(branch: &Option<String>) -> Result<String, String> {
    match branch.as_deref() {
        None | Some("") => Ok(String::new()),
        Some(b) if b.starts_with('-') || b.contains("..") || b.chars().any(|c| c.is_control() || c.is_whitespace() || "?#&~^:\\".contains(c)) => Err("Invalid branch name.".into()),
        Some(b) => Ok(format!("?ref={}", encode_path(b))),
    }
}

fn encode_path(path: &str) -> String {
    path.split('/').map(|seg| seg.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>()).collect::<Vec<_>>().join("/")
}

#[tauri::command]
async fn repo_branches(full_name: String) -> Result<Vec<String>, String> {
    split_repo(&full_name)?;
    tauri::async_runtime::spawn_blocking(move || {
        #[derive(Deserialize)]
        struct B { name: String }
        let list: Vec<B> = gh(&format!("repos/{full_name}/branches?per_page=100"), true)?;
        Ok(list.into_iter().map(|b| b.name).collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn repo_files(full_name: String, path: String, branch: Option<String>) -> Result<Vec<Entry>, String> {
    split_repo(&full_name)?;
    let query = ref_query(&branch)?;
    if path.split('/').any(|seg| seg == "..") {
        return Err("Invalid path.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut entries: Vec<Entry> = gh(&format!("repos/{full_name}/contents/{}{query}", encode_path(&path)), false)?;
        // Folders first, then alphabetical.
        entries.sort_by(|a, b| (a.kind != "dir").cmp(&(b.kind != "dir")).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

// Local actions only run inside a repository under the clone folder.
fn repo_dir(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let root = clone_dir(app)?.canonicalize().map_err(|_| "The clone folder does not exist.".to_string())?;
    let dir = Path::new(path).canonicalize().map_err(|_| "This folder no longer exists.".to_string())?;
    if !dir.starts_with(&root) || !dir.join(".git").exists() {
        return Err("This is not a repository in the clone folder.".into());
    }
    Ok(dir)
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git").arg("-C").arg(dir).args(args).env("GIT_TERMINAL_PROMPT", "0").output().ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim_end().to_string())
}

#[derive(Serialize)]
struct Commit {
    hash: String,
    subject: String,
    author: String,
    date: String,
}

#[derive(Serialize, Default)]
struct GitInfo {
    branch: String,
    upstream: Option<String>,
    ahead: u32,
    behind: u32,
    changed: u32,
    untracked: u32,
    conflicted: u32,
    last_commit: Option<Commit>,
    remote: Option<String>,
    branches: u32,
    stashes: u32,
}

fn git_info(dir: &Path) -> Result<GitInfo, String> {
    let status = git(dir, &["status", "--porcelain=v2", "--branch"]).ok_or("Could not read the git status of this repository.")?;
    let mut info = GitInfo::default();
    for line in status.lines() {
        if let Some(v) = line.strip_prefix("# branch.head ") {
            info.branch = v.to_string();
        } else if let Some(v) = line.strip_prefix("# branch.upstream ") {
            info.upstream = Some(v.to_string());
        } else if let Some(v) = line.strip_prefix("# branch.ab ") {
            let mut n = v.split_whitespace().map(|x| x.trim_start_matches(['+', '-']).parse::<u32>().unwrap_or(0));
            info.ahead = n.next().unwrap_or(0);
            info.behind = n.next().unwrap_or(0);
        } else if line.starts_with("u ") {
            info.conflicted += 1;
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            info.changed += 1;
        } else if line.starts_with("? ") {
            info.untracked += 1;
        }
    }
    info.last_commit = git(dir, &["log", "-1", "--format=%h%x1f%s%x1f%an%x1f%cI"]).and_then(|l| {
        let mut p = l.split('\x1f').map(String::from);
        Some(Commit { hash: p.next()?, subject: p.next()?, author: p.next()?, date: p.next()? })
    });
    info.remote = git(dir, &["remote", "get-url", "origin"]);
    info.branches = git(dir, &["for-each-ref", "refs/heads"]).map_or(0, |o| o.lines().count() as u32);
    info.stashes = git(dir, &["stash", "list"]).map_or(0, |o| o.lines().count() as u32);
    Ok(info)
}

#[tauri::command]
async fn git_status(app: AppHandle, path: String) -> Result<GitInfo, String> {
    let dir = repo_dir(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || git_info(&dir)).await.map_err(|e| e.to_string())?
}

// Refreshes remote refs only (no merge), so "behind" counts become accurate.
#[tauri::command]
async fn git_fetch(app: AppHandle, path: String) -> Result<GitInfo, String> {
    let dir = repo_dir(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || {
        git(&dir, &["fetch", "--prune"]).ok_or("Fetch failed. Check your connection and GitHub access.")?;
        git_info(&dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct Branches {
    local: Vec<String>,
    // Branches that exist only on origin: switching to one creates a local tracking branch.
    remote: Vec<String>,
}

#[tauri::command]
async fn git_branches(app: AppHandle, path: String) -> Result<Branches, String> {
    let dir = repo_dir(&app, &path)?;
    tauri::async_runtime::spawn_blocking(move || {
        let list = |refs: &str| git(&dir, &["for-each-ref", "--format=%(refname:short)", refs]).unwrap_or_default().lines().map(String::from).collect::<Vec<_>>();
        let local = list("refs/heads");
        let remote = list("refs/remotes/origin").into_iter().filter_map(|b| b.strip_prefix("origin/").map(String::from)).filter(|b| b != "HEAD" && !local.contains(b)).collect();
        Ok(Branches { local, remote })
    })
    .await
    .map_err(|e| e.to_string())?
}

// Plain `git switch`: git itself refuses when local changes would be overwritten.
#[tauri::command]
async fn git_switch(app: AppHandle, path: String, branch: String) -> Result<GitInfo, String> {
    let dir = repo_dir(&app, &path)?;
    if branch.is_empty() || branch.starts_with('-') || branch.contains("..") || branch.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err("Invalid branch name.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let out = Command::new("git").arg("-C").arg(&dir).args(["switch", &branch]).env("GIT_TERMINAL_PROMPT", "0").output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        git_info(&dir)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct FileContent {
    // "text" | "image" | "binary" | "large"
    kind: &'static str,
    text: Option<String>,
    data_url: Option<String>,
    size: u64,
}

#[tauri::command]
async fn repo_file(full_name: String, path: String, branch: Option<String>) -> Result<FileContent, String> {
    split_repo(&full_name)?;
    let query = ref_query(&branch)?;
    if path.is_empty() || path.split('/').any(|seg| seg == "..") {
        return Err("Invalid path.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use base64::{Engine, engine::general_purpose::STANDARD};
        #[derive(Deserialize)]
        struct Raw { size: u64, #[serde(default)] content: String, #[serde(default)] encoding: String }
        let raw: Raw = gh(&format!("repos/{full_name}/contents/{}{query}", encode_path(&path)), false)?;
        // The contents API omits the body above 1 MB.
        if raw.encoding != "base64" || (raw.content.is_empty() && raw.size > 0) {
            return Ok(FileContent { kind: "large", text: None, data_url: None, size: raw.size });
        }
        let compact: String = raw.content.chars().filter(|c| !c.is_whitespace()).collect();
        let bytes = STANDARD.decode(compact).map_err(|e| e.to_string())?;
        let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
        let image = match ext.as_str() { "png" => Some("image/png"), "jpg" | "jpeg" => Some("image/jpeg"), "gif" => Some("image/gif"), "webp" => Some("image/webp"), "svg" => Some("image/svg+xml"), "ico" => Some("image/x-icon"), _ => None };
        if let Some(mime) = image {
            return Ok(FileContent { kind: "image", text: None, data_url: Some(format!("data:{mime};base64,{}", STANDARD.encode(&bytes))), size: raw.size });
        }
        if bytes.contains(&0) {
            return Ok(FileContent { kind: "binary", text: None, data_url: None, size: raw.size });
        }
        Ok(FileContent { kind: "text", text: Some(String::from_utf8_lossy(&bytes).into_owned()), data_url: None, size: raw.size })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize, Clone)]
#[serde(tag = "event", content = "data", rename_all = "lowercase")]
enum Output {
    Line { stream: &'static str, text: String },
    Done { code: Option<i32> },
}

#[derive(Default)]
struct Running(Mutex<HashSet<u32>>);

// Runs a shell command in a cloned repository and streams its output.
// The UI asks for confirmation first; only repositories under the clone folder are accepted.
#[tauri::command]
fn run_command(app: AppHandle, state: State<Running>, path: String, command: String, on_event: Channel<Output>) -> Result<u32, String> {
    if command.trim().is_empty() || command.len() > 20_000 {
        return Err("Invalid command.".into());
    }
    let dir = repo_dir(&app, &path)?;
    let mut cmd = if cfg!(windows) { let mut c = Command::new("cmd"); c.args(["/C", &command]); c } else { let mut c = Command::new("sh"); c.args(["-c", &command]); c };
    cmd.current_dir(dir).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut cmd, 0);
    let mut child = cmd.spawn().map_err(|e| format!("Could not start the command: {e}"))?;
    let pid = child.id();
    state.0.lock().unwrap().insert(pid);
    let pump = |stream: &'static str, source: Box<dyn std::io::Read + Send>| {
        let tx = on_event.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(source).lines().map_while(Result::ok) {
                let _ = tx.send(Output::Line { stream, text: line });
            }
        })
    };
    let readers = [pump("out", Box::new(child.stdout.take().unwrap())), pump("err", Box::new(child.stderr.take().unwrap()))];
    let handle = app.clone();
    std::thread::spawn(move || {
        for r in readers { let _ = r.join(); }
        let code = child.wait().ok().and_then(|s| s.code());
        handle.state::<Running>().0.lock().unwrap().remove(&pid);
        let _ = on_event.send(Output::Done { code });
    });
    Ok(pid)
}

#[tauri::command]
fn stop_command(state: State<Running>, id: u32) {
    // Only processes started by run_command can be stopped.
    if !state.0.lock().unwrap().contains(&id) { return }
    let _ = if cfg!(windows) {
        Command::new("taskkill").args(["/T", "/F", "/PID", &id.to_string()]).status()
    } else {
        // Negative pid targets the whole process group (the shell and its children).
        Command::new("kill").args(["-TERM", "--", &format!("-{id}")]).status()
    };
}

#[tauri::command]
async fn clone_repo(app: AppHandle, full_name: String) -> Result<String, String> {
    let (_, name) = split_repo(&full_name)?;
    let name = name.to_string();
    let dir = clone_dir(&app)?;
    let dest = dir.join(&name);
    if dest.exists() {
        return Err(format!("A folder named “{name}” already exists in {}.", dir.display()));
    }
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let out = Command::new("gh").args(["repo", "clone", &full_name]).arg(&dest).output().map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(dest.to_string_lossy().into_owned())
        } else {
            Err(format!("Clone failed: {}", String::from_utf8_lossy(&out.stderr).trim()))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// Launchers: (id, name, binary, leading args). The frontend only sends an id, never a command.
const COMMANDS: &[(&str, &str, &str, &[&str])] = &[
    ("code", "VS Code", "code", &[]),
    ("cursor", "Cursor", "cursor", &[]),
    ("zed", "Zed", "zed", &[]),
    ("codium", "VSCodium", "codium", &[]),
    ("idea", "IntelliJ IDEA", "idea", &[]),
    ("webstorm", "WebStorm", "webstorm", &[]),
    ("pycharm", "PyCharm", "pycharm", &[]),
    ("rustrover", "RustRover", "rustrover", &[]),
    ("subl", "Sublime Text", "subl", &[]),
    ("codex", "Codex", "codex", &["app"]),
];

fn on_path(bin: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|p| std::env::split_paths(&p).any(|d| d.join(bin).is_file()))
}

fn claude_installed() -> bool {
    if cfg!(target_os = "linux") {
        Command::new("xdg-mime").args(["query", "default", "x-scheme-handler/claude"]).output().is_ok_and(|o| !o.stdout.trim_ascii().is_empty())
    } else if cfg!(target_os = "macos") {
        Path::new("/Applications/Claude.app").exists()
    } else {
        true
    }
}

#[derive(Serialize)]
struct Tool {
    id: &'static str,
    name: &'static str,
    // "url": opened as a deep link by the frontend; "command": launched by open_with.
    kind: &'static str,
}

#[tauri::command]
fn tools() -> Vec<Tool> {
    let mut list = vec![];
    if claude_installed() {
        list.push(Tool { id: "claude", name: "Claude Desktop", kind: "url" });
    }
    list.extend(COMMANDS.iter().filter(|c| on_path(c.2)).map(|c| Tool { id: c.0, name: c.1, kind: "command" }));
    list
}

#[tauri::command]
fn open_with(id: String, path: String) -> Result<(), String> {
    let (_, name, bin, lead) = COMMANDS.iter().find(|c| c.0 == id).ok_or("Unknown application.")?;
    if !Path::new(&path).is_dir() {
        return Err("This folder no longer exists.".into());
    }
    Command::new(bin).args(*lead).arg(&path).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| format!("Could not start {name}: {e}"))?;
    Ok(())
}

#[tauri::command]
async fn overview(app: AppHandle) -> Result<Overview, String> {
    let dir = clone_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let local = find_local(&dir);
        #[derive(Deserialize)]
        struct User { login: String }
        let user: User = gh("user", false)?;
        let repos: Vec<Raw> = gh("user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100", true)?;
        let collabs: Vec<Raw> = gh("user/repos?affiliation=collaborator&per_page=100", true)?;
        let collab_ids: HashSet<u64> = collabs.iter().map(|r| r.id).collect();
        // Counts are optional: on failure the UI simply shows no number.
        let prs = open_prs().unwrap_or_default();
        let (invitations, warning) = match gh::<Vec<Invitation>>("user/repository_invitations?per_page=100", true) {
            Ok(v) => (v, None),
            Err(_) => (vec![], Some("Invitations could not be loaded. Check your GitHub permissions and try again.".to_string())),
        };
        Ok(Overview {
            login: user.login,
            clone_dir: dir.to_string_lossy().into_owned(),
            repos: repos.into_iter().map(|r| { let c = collab_ids.contains(&r.id); let n = prs.get(&r.full_name.to_lowercase()).copied(); let mut x = repo(r, c, None, n); x.local_path = local.get(&x.full_name.to_lowercase()).cloned(); x.icon = x.local_path.as_deref().and_then(|p| find_icon(Path::new(p))); x }).collect(),
            invitations: invitations.into_iter().map(|i| repo(i.repository, false, Some(i.created_at), None)).collect(),
            warning,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // shortcut: fixed Homebrew dirs, not the login shell's PATH; upgrade if gh lives elsewhere (nix, MacPorts).
    // A Finder-launched app gets a minimal PATH that lacks Homebrew, so `gh` and `git` are not found.
    #[cfg(target_os = "macos")]
    {
        let old = std::env::var_os("PATH").unwrap_or_default();
        let dirs = ["/opt/homebrew/bin", "/usr/local/bin"].map(std::path::PathBuf::from).into_iter().chain(std::env::split_paths(&old));
        if let Ok(path) = std::env::join_paths(dirs) {
            // SAFETY: runs first thing in main, before any thread is spawned.
            unsafe { std::env::set_var("PATH", path) };
        }
    }
    tauri::Builder::default()
        .manage(Running::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![overview, repo_branches, git_branches, git_switch, git_status, git_fetch, repo_file, run_command, stop_command, repo_detail, repo_files, repo_icon, set_clone_dir, clone_repo, tools, open_with])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
