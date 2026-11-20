import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Renders a README to sanitized HTML, pointing relative images and links at GitHub.
export function renderReadme(markdown: string, fullName: string, branch: string, readmePath: string): string {
  const dir = readmePath.includes('/') ? readmePath.slice(0, readmePath.lastIndexOf('/') + 1) : '';
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(marked.parse(markdown, { async: false })), 'text/html');
  const resolve = (value: string, base: string) => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(value)) return value;
    const root = value.startsWith('/');
    try {
      return new URL(root ? value.slice(1) : value, `${base}/${branch}/${root ? '' : dir}`).href;
    } catch {
      return value;
    }
  };
  doc.querySelectorAll('img[src]').forEach(img => img.setAttribute('src', resolve(img.getAttribute('src')!, `https://raw.githubusercontent.com/${fullName}`)));
  doc.querySelectorAll('a[href]').forEach(a => a.setAttribute('href', resolve(a.getAttribute('href')!, `https://github.com/${fullName}/blob`)));
  return doc.body.innerHTML;
}
