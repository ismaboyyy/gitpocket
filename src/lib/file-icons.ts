import { fileExtensions, fileNames, folderNames, iconDefinitions } from 'material-icon-theme/dist/material-icons.json';

// Material Icon Theme SVGs (open-folder and light variants are skipped to keep the bundle smaller).
const urls = import.meta.glob(['/node_modules/material-icon-theme/icons/*.svg', '!**/*-open.svg', '!**/*_light.svg'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const byName = new Map(Object.entries(urls).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

const names = fileNames as Record<string, string>;
const extensions = fileExtensions as Record<string, string>;
const folders = folderNames as Record<string, string>;
const defs = iconDefinitions as Record<string, { iconPath: string }>;

const urlOf = (icon: string | undefined, fallback: string) => {
  const file = icon && defs[icon]?.iconPath.split('/').pop()?.slice(0, -4);
  return (file && byName.get(file)) || byName.get(fallback)!;
};

export function fileIconUrl(name: string, dir: boolean): string {
  const lower = name.toLowerCase();
  if (dir) return urlOf(folders[lower], 'folder');
  if (names[lower]) return urlOf(names[lower], 'file');
  // "a.test.ts": try "test.ts" first, then "ts".
  const parts = lower.split('.');
  for (let i = 1; i < parts.length; i++) {
    const icon = extensions[parts.slice(i).join('.')];
    if (icon) return urlOf(icon, 'file');
  }
  return urlOf(undefined, 'file');
}
