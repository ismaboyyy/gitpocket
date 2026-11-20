<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/gradient.svg?title=GitPocket&amp;subtitle=Every+GitHub+repo+you+own%2C+share+or+were+invited+to%2C+in+one+place&amp;theme=rose&amp;mode=dark&amp;logo=https://raw.githubusercontent.com/swaiku/gitpocket/main/art/logo-white.svg%3Fv%3D2">
    <img alt="GitPocket — every GitHub repo you own, share or were invited to, in one place" src="https://shieldcn.dev/header/gradient.svg?title=GitPocket&amp;subtitle=Every+GitHub+repo+you+own%2C+share+or+were+invited+to%2C+in+one+place&amp;theme=rose&amp;mode=light&amp;logo=https://raw.githubusercontent.com/swaiku/gitpocket/main/art/logo.svg%3Fv%3D2" />
  </picture>
</p>

<p align="center">
  <strong>One window for all your GitHub repositories · Clone · Open in your IDE · Browse files and READMEs · Track local branches</strong>
</p>

<p align="center">
  <a href="https://github.com/swaiku/gitpocket"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/group/github/swaiku/gitpocket/stars+github/swaiku/gitpocket/license+github/swaiku/gitpocket/last-commit.svg?variant=branded&amp;size=xs" /><img alt="GitPocket stats" src="https://shieldcn.dev/group/github/swaiku/gitpocket/stars+github/swaiku/gitpocket/license+github/swaiku/gitpocket/last-commit.svg?variant=branded&amp;size=xs&amp;mode=light" /></picture></a>
  <a href="https://github.com/swaiku/gitpocket/releases/latest"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/release/swaiku/gitpocket.svg?variant=branded&amp;size=xs" /><img alt="Latest release" src="https://shieldcn.dev/github/release/swaiku/gitpocket.svg?variant=branded&amp;size=xs&amp;mode=light" /></picture></a>
  <a href="https://github.com/swaiku/gitpocket/actions/workflows/ci.yml"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/github/ci/swaiku/gitpocket.svg?variant=branded&amp;size=xs" /><img alt="CI" src="https://shieldcn.dev/github/ci/swaiku/gitpocket.svg?variant=branded&amp;size=xs&amp;mode=light" /></picture></a>
</p>

<p align="center">
  <a href="https://tauri.app"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Tauri-2-24C8D8.svg?variant=branded&amp;size=xs&amp;logo=tauri" /><img alt="Tauri 2" src="https://shieldcn.dev/badge/Tauri-2-24C8D8.svg?variant=branded&amp;size=xs&amp;logo=tauri&amp;mode=light" /></picture></a>
  <a href="https://svelte.dev"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Svelte-5-FF3E00.svg?variant=branded&amp;size=xs&amp;logo=svelte" /><img alt="Svelte 5" src="https://shieldcn.dev/badge/Svelte-5-FF3E00.svg?variant=branded&amp;size=xs&amp;logo=svelte&amp;mode=light" /></picture></a>
  <a href="https://www.rust-lang.org"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Rust-backend-CE422B.svg?variant=branded&amp;size=xs&amp;logo=rust" /><img alt="Rust backend" src="https://shieldcn.dev/badge/Rust-backend-CE422B.svg?variant=branded&amp;size=xs&amp;logo=rust&amp;mode=light" /></picture></a>
  <a href="https://www.typescriptlang.org"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/TypeScript-frontend-3178C6.svg?variant=branded&amp;size=xs&amp;logo=typescript" /><img alt="TypeScript frontend" src="https://shieldcn.dev/badge/TypeScript-frontend-3178C6.svg?variant=branded&amp;size=xs&amp;logo=typescript&amp;mode=light" /></picture></a>
  <a href="https://bun.sh"><picture><source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Bun-tooling-FBF0DF.svg?variant=branded&amp;size=xs&amp;logo=bun" /><img alt="Bun tooling" src="https://shieldcn.dev/badge/Bun-tooling-FBF0DF.svg?variant=branded&amp;size=xs&amp;logo=bun&amp;mode=light" /></picture></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#development">Development</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

**GitPocket** is a small desktop app that answers a surprisingly hard question on GitHub: *which repositories can I actually access?*

On github.com, the repos you created, the ones you collaborate on, the ones of the organizations you belong to, and the invitations you have not accepted yet live on different pages, with different filters, and none of them tells you what is already on your disk. GitPocket puts all of them in one searchable list, and goes one step further: clone a repo, open it in your editor or AI assistant, read its README, and see whether your local copy is up to date.

> **Read-only by design.** GitPocket never writes to GitHub. It asks the [GitHub CLI](https://cli.github.com/) for data and stores no token.

## Table of contents

- [Why GitPocket](#why-gitpocket)
- [Features](#features)
- [Quick start](#quick-start)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why GitPocket

| You want… | GitPocket gives you… |
| --- | --- |
| Find a repo you created years ago | One list with search, owner, visibility and sort filters |
| See repos where you are only a collaborator | Dedicated **Collaborations** and **Shared** tabs |
| Not miss an invitation | An **Invitations** tab, with the invitation date |
| Know what is already cloned | A **Stored locally** marker, found by scanning your clone folder |
| Jump from GitHub to your editor | **Open** menu: Claude Desktop, Codex, VS Code, Cursor, Zed, JetBrains… |
| Check a repo without leaving the app | File browser, syntax-highlighted viewer and rendered README |
| Know if your clone is behind | Branch, ahead/behind, uncommitted changes and last commit |

**Not for you if** you need to create issues, review pull requests or manage repositories. GitPocket is a *finder and launcher*, not a GitHub client.

## Features

- **Everything you can access, in one place**: owned, collaborator, organization member and pending invitations
- **Fast filtering**: instant search (press `/`), multi-select owners, visibility, four sort orders, per-tab counters
- **Detected additions**: sort by the repos that appeared since your last visit
- **Open pull request counts** on every repository
- **Language at a glance**: colored badge for the main language, repository logo or owner avatar
- **List or card layout**, remembered between launches
- **System dark mode**, followed live
- **One-click clone** into a folder you choose, and recursive detection of repos you already cloned
- **Open with the apps you have**: Claude Desktop, Codex and the IDEs found on your `PATH`, with their logos
- **Repository page**: files with per-type icons, line-numbered code viewer, rendered README, any GitHub branch
- **Run README commands** (only on cloned repos, always after a confirmation) with a resizable output panel
- **Local copy panel**: switch branch, see sync status, working tree state, last commit and `fetch`

## Quick start

### 1. Requirements

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) and the [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS
- [GitHub CLI](https://cli.github.com/), signed in:

```bash
gh auth login --hostname github.com
```

### 2. Get the code

```bash
gh repo clone swaiku/gitpocket
cd gitpocket
bun install
```

### 3. Run it

```bash
bun run tauri dev
```

To build an installable package instead:

```bash
bun run tauri build
```

> GitPocket is developed and tested on Linux. It uses no Linux-only API, but macOS and Windows builds have not been tested yet.

## Usage

### Find a repository

Use the tabs (**All**, **Collaborations**, **Shared**, **Invitations**), the search box, and the owner, visibility and sort menus. Counters on the tabs ignore the other filters, so you always know how many repos each tab holds.

### Clone and open

The folder icon in the header shows where repositories are cloned (default `~/Projects`). Click it to change.

- **Clone** runs `gh repo clone` into that folder.
- Repos already on your disk are found by scanning the folder recursively (up to four levels), and get an **Open** menu.
- **Open** lists the installed apps: Claude Desktop (via its `claude://` link), Codex (`codex app`), and IDEs found on your `PATH` (VS Code, Cursor, Zed, VSCodium, JetBrains IDEs, Sublime Text).

### Repository page

Click a repository to open its page: the left column describes your local copy, the right one lets you browse GitHub.

- Pick any branch to browse its files and README.
- Click a file to read it in a side panel, with syntax highlighting and line numbers.
- On a cloned repo, shell code blocks in the README get a **▶ Run** button. Every run asks for confirmation, shows the command and the folder, then streams its output in a panel you can resize and stop.
- The **Local copy** panel shows the current branch (and lets you switch it), whether you are ahead or behind, uncommitted changes, the last commit and the number of branches and stashes. The ↻ button runs `git fetch` so the status is current.

## How it works

```
┌──────────────────────────┐   invoke / events    ┌─────────────────────────────┐
│  SvelteKit (SPA)         │ ───────────────────► │  Rust (Tauri 2)             │
│  Svelte 5 · TypeScript   │                      │  gh api · git · filesystem  │
│  Tailwind v4 · shadcn    │ ◄─────────────────── │  no token stored            │
└──────────────────────────┘     typed results    └──────────────┬──────────────┘
                                                                 │
                                          GitHub CLI (your session) · git · your IDEs
```

| Layer | Technology |
| --- | --- |
| Shell | [Tauri 2](https://tauri.app) |
| Backend | Rust: calls `gh api` (REST and GraphQL), `git` and the filesystem |
| Frontend | [SvelteKit](https://svelte.dev/docs/kit) in SPA mode, Svelte 5, TypeScript |
| UI | [Tailwind CSS v4](https://tailwindcss.com) and [shadcn-svelte](https://shadcn-svelte.com) |
| Icons | [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme), [Lucide](https://lucide.dev) |
| Tooling | [Bun](https://bun.sh) |

**Security notes**

- Authentication is delegated to the GitHub CLI: GitPocket has no OAuth app, secret or token storage.
- The frontend never sends a command to run, only an application id, and Rust refuses any folder outside your clone folder.
- README commands run with your permissions. They only start after you confirm the exact command.
- READMEs are sanitized with DOMPurify before display.

## Project structure

```
.
├── src/                      SvelteKit frontend
│   ├── routes/+page.svelte   Repository list
│   └── lib/
│       ├── components/       Repo page, local info, file viewer, run panel, shadcn/ui
│       ├── filters.ts        Filtering and sorting (unit tested)
│       └── *.svelte.ts       Shared state: clone/open actions, command runner
├── src-tauri/src/lib.rs      Rust commands: GitHub, git, clone, open, run
├── static/icons/             Logos of supported apps
├── art/                      README banner
└── .devcontainer/            Tauri system dependencies, X11 forwarding
```

## Development

```bash
bun run tauri dev     # app with hot reload
bun run check         # types and Svelte diagnostics
bun test src/lib      # unit tests
```

### Devcontainer

`.devcontainer/` provides Rust, Bun, GitHub CLI and the Tauri system dependencies, and mounts your host `~/Projects`. It is handy to type-check, test and compile. To display the window from the container, allow local X connections on the host first:

```bash
xhost +local:
```

Host applications (IDEs, Claude Desktop) are not visible from inside the container, so test the **Open** menu by running the app on the host. You also need to run `gh auth login` again inside the container.

## Releases

Work lands on `develop` and is released from `main`, like the other projects of this account:

1. **CI** runs on every push and pull request: type check, tests, frontend build and `cargo check`. Pushes to `develop` (and pull requests to `main`) also build a debug `.deb`.
2. Run the **Prepare release** workflow: it bumps the version (`package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`), updates `CHANGELOG.md` from the gitmoji commits and opens the `develop` → `main` pull request.
3. Merging that pull request runs **Release**: it builds the installers for Linux, macOS (Apple silicon and Intel) and Windows, then publishes the GitHub release and its tag.

The installers are not code-signed, so macOS and Windows warn on first launch. GitHub CLI must be installed and signed in on the machine that runs GitPocket.

Dependabot opens weekly update pull requests against `develop` and merges minor and patch updates once CI is green.

## Contributing

Issues and pull requests are welcome. Please run `bun run check` and `bun test src/lib` before opening a pull request, and keep the app read-only toward GitHub.

## License

[MIT](./LICENSE). Originally created by [ismaboyyy](https://github.com/ismaboyyy/gitpocket), now maintained and rebuilt in this fork.

<p align="center"><sub>Built with Tauri, Svelte and shadcn-svelte.</sub></p>
