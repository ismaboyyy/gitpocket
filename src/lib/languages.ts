// GitHub's language colors for the most common languages; others get a neutral dot.
const colors: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Svelte: '#ff3e00', Rust: '#dea584', Python: '#3572a5', Go: '#00add8',
  Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Dart: '#00b4ab',
  PHP: '#4f5d95', Ruby: '#701516', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c', Shell: '#89e051', Lua: '#000080',
  Vue: '#41b883', Dockerfile: '#384d54', Nix: '#7e7eff', Zig: '#ec915c', Elixir: '#6e4a7e', Haskell: '#5e5086',
  Jupyter: '#da5b0b', 'Jupyter Notebook': '#da5b0b', GDScript: '#355570', Scala: '#c22d40', R: '#198ce7', TeX: '#3d6117',
};
export const languageColor = (name: string) => colors[name] ?? '#8b8b8b';
