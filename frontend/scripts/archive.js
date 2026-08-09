const GROUPS = ['A-C', 'D-F', 'G-I', 'J-L', 'M-O', 'P-R', 'S-U', 'V-X', 'Y-Z'];

const cabinetsEl = document.getElementById('cabinets');
const modal = document.getElementById('drawer-modal');
const cardsEl = document.getElementById('cards-container');
const searchInput = document.getElementById('drawer-search');
const drawerTotal = document.querySelector('[data-drawer-total]');
const drawerLetters = document.querySelector('[data-drawer-letters]');
const archiveEmpty = document.getElementById('archive-empty');

let currentGroup = null;
let searchTimer = null;

function buildCabinets() {
  cabinetsEl.innerHTML = GROUPS.map(
    (g) => `
    <div class="filing-cabinet" data-group="${g}" role="button" tabindex="0" aria-label="Abrir archivo ${g}">
      <div class="cabinet-frame">
        <div class="cabinet-top"></div>
        <div class="drawer">
          <div class="drawer-handle"></div>
          <div class="drawer-label">${g}</div>
          <div class="drawer-count">…</div>
        </div>
      </div>
      <div class="cabinet-shadow"></div>
    </div>
  `
  ).join('');
}

async function loadCounts() {
  const totals = await Promise.all(
    GROUPS.map(async (g) => {
      try {
        const res = await fetch(`/api/fears?letter=${encodeURIComponent(g)}&limit=1`);
        const data = await res.json();
        return data.total || 0;
      } catch {
        return 0;
      }
    })
  );

  GROUPS.forEach((g, i) => {
    const el = cabinetsEl.querySelector(`[data-group="${g}"] .drawer-count`);
    el.textContent = `${totals[i]} miedo${totals[i] === 1 ? '' : 's'}`;
  });

  archiveEmpty.hidden = totals.some((t) => t > 0);
}

function openDrawer(group) {
  currentGroup = group;
  drawerLetters.textContent = group;
  searchInput.value = '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  loadFears(group, '');
}

function closeDrawer() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

async function loadFears(group, query) {
  cardsEl.innerHTML = '<p class="loading-note">Abriendo el cajón...</p>';
  drawerTotal.textContent = '…';

  const url = query
    ? `/api/fears/search?q=${encodeURIComponent(query)}&limit=50`
    : `/api/fears?letter=${encodeURIComponent(group)}&limit=50`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    drawerTotal.textContent = data.total ?? 0;

    if (!data.items || data.items.length === 0) {
      cardsEl.innerHTML =
        '<p class="loading-note">Este cajón está vacío. Sé el primero en depositar un miedo.</p>';
      return;
    }

    cardsEl.innerHTML = data.items.map((fear, i) => cardHTML(fear, i)).join('');
  } catch {
    cardsEl.innerHTML = '<p class="loading-note">No se pudo abrir el cajón. Inténtalo de nuevo.</p>';
  }
}

function cardHTML(fear, index) {
  return `
    <article class="fear-card" style="animation-delay: ${index * 0.05}s">
      <p class="fear-text">${escapeHtml(fear.content)}</p>
      <div class="fear-meta">
        <span class="fear-date">depositado el ${formatDate(fear.created_at)}</span>
        <div class="reaction-buttons">
          <button class="reaction-btn apoyo" data-id="${fear.id}" data-type="apoyo" aria-label="Dar apoyo a este miedo">
            <span class="reaction-emoji" aria-hidden="true">🫂</span>
            <span class="reaction-count">${fear.apoyos ?? 0}</span>
          </button>
          <button class="reaction-btn fuerza" data-id="${fear.id}" data-type="fuerza" aria-label="Dar fuerza a este miedo">
            <span class="reaction-emoji" aria-hidden="true">💪</span>
            <span class="reaction-count">${fear.fuerzas ?? 0}</span>
          </button>
        </div>
      </div>
    </article>
  `;
}

cabinetsEl.addEventListener('click', (e) => {
  const cabinet = e.target.closest('.filing-cabinet');
  if (cabinet) openDrawer(cabinet.dataset.group);
});

cabinetsEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const cabinet = e.target.closest('.filing-cabinet');
    if (cabinet) {
      e.preventDefault();
      openDrawer(cabinet.dataset.group);
    }
  }
});

document.querySelectorAll('[data-close-drawer]').forEach((el) => {
  el.addEventListener('click', closeDrawer);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeDrawer();
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  searchTimer = setTimeout(() => loadFears(currentGroup, q), 300);
});

cardsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.reaction-btn');
  if (!btn || btn.classList.contains('reacted') || btn.dataset.busy) return;
  btn.dataset.busy = '1';

  try {
    const res = await fetch(`/api/fears/${btn.dataset.id}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: btn.dataset.type }),
    });
    const data = await res.json();
    if (res.ok) {
      btn.classList.add('reacted');
      btn.querySelector('.reaction-count').textContent = data[btn.dataset.type];
      const otherType = btn.dataset.type === 'apoyo' ? 'fuerza' : 'apoyo';
      const otherCount = data[otherType === 'apoyo' ? 'apoyos' : 'fuerzas'];
      const pair = btn.closest('.reaction-buttons').querySelector(`[data-type="${otherType}"]`);
      if (pair) pair.querySelector('.reaction-count').textContent = otherCount;
    }
  } catch {
    /* sin acción en silencio */
  } finally {
    delete btn.dataset.busy;
  }
});

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(raw) {
  const [datePart] = String(raw || '').split(' ');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

buildCabinets();
loadCounts();
