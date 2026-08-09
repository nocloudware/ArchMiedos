const README_URL = 'https://raw.githubusercontent.com/nocloudware/ArchMiedos/main/README.md';
const REPO_URL = 'https://github.com/nocloudware/ArchMiedos';

const contentEl = document.getElementById('mision-content');
const statusEl = document.getElementById('mision-status');

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadMision() {
  try {
    const res = await fetch(README_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();

    const renderer = new marked.Renderer();
    renderer.html = (html) => escapeHtml(html);
    renderer.link = (href, title, text) => {
      const target = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${href}"${title ? ` title="${title}"` : ''}${target}>${text}</a>`;
    };

    const html = marked.parse(md, { renderer, gfm: true, breaks: true });
    contentEl.innerHTML = html;
  } catch {
    statusEl.textContent = 'No se pudo cargar el texto de la misión desde GitHub.';
    contentEl.innerHTML =
      `<p class="empty-note">Revisa la misión directamente en el repositorio: ` +
      `<a href="${REPO_URL}" target="_blank" rel="noopener">github.com/nocloudware/ArchMiedos</a></p>`;
  }
}

document.addEventListener('DOMContentLoaded', loadMision);
