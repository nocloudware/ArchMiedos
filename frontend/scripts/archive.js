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
  setActiveCabinet(group);
  history.replaceState(null, '', `${location.pathname}?cajon=${encodeURIComponent(group)}`);
  loadFears(group, '');
}

function closeDrawer() {
  modal.hidden = true;
  document.body.style.overflow = '';
  setActiveCabinet(null);
  history.replaceState(null, '', location.pathname);
}

function setActiveCabinet(group) {
  document.querySelectorAll('.side-tab.cab').forEach((el) => {
    el.classList.toggle('active', el.dataset.group === group);
  });
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
      <div class="fear-share">
        <button class="share-btn" data-id="${fear.id}" data-content="${escapeHtml(fear.content)}" data-date="${fear.created_at}" data-apoyos="${fear.apoyos ?? 0}" data-fuerzas="${fear.fuerzas ?? 0}" aria-label="Compartir este miedo en Bluesky">
          Compartir en Bluesky ↗
        </button>
        <span class="share-note">Se publica de forma anónima en @archmiedos.bsky.social</span>
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
  const shareBtn = e.target.closest('.share-btn');
  if (shareBtn) {
    await shareFear(shareBtn);
    return;
  }

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

async function shareFear(btn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const original = btn.textContent;
  btn.textContent = 'Publicando en Bluesky...';

  try {
    const image = renderFearCard({
      content: btn.dataset.content || '',
      created_at: btn.dataset.date || '',
      apoyos: btn.dataset.apoyos,
      fuerzas: btn.dataset.fuerzas,
    });
    const res = await fetch(`/api/fears/${btn.dataset.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (res.ok && data.url) {
      const span = document.createElement('span');
      span.className = 'share-done';
      span.innerHTML = `Compartido ✓ <a href="${data.url}" target="_blank" rel="noopener">ver el post ↗</a>`;
      btn.replaceWith(span);
    } else {
      btn.textContent = data.error || 'No se pudo compartir';
      btn.classList.add('share-error');
    }
  } catch {
    btn.textContent = 'Error al compartir';
    btn.classList.add('share-error');
  } finally {
    delete btn.dataset.busy;
    if (btn.textContent !== original && btn.classList.contains('share-error')) {
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('share-error');
      }, 3500);
    }
  }
}

function renderFearCard(fear) {
  const W = 900;
  const H = 900;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#faf5e9';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, 0, W, 16);

  ctx.strokeStyle = '#6b4f3a';
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3526';
  ctx.font = '600 46px Georgia, serif';
  ctx.fillText('Archivo de Miedos', W / 2, 108);
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#6b4f3a';
  ctx.fillText('Est. 1950 · Departamento de Liberación Emocional', W / 2, 152);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c2417';
  ctx.font = '30px Georgia, serif';
  const lines = wrapText(ctx, fear.content || '', W - 150);
  let y = 220;
  const maxLines = 13;
  lines.slice(0, maxLines).forEach((l) => {
    ctx.fillText(l, 75, y);
    y += 44;
  });
  if (lines.length > maxLines) {
    ctx.fillText('…', 75, y);
    y += 44;
  }

  y += 22;
  ctx.strokeStyle = '#e8dfc8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(75, y);
  ctx.lineTo(W - 75, y);
  ctx.stroke();

  ctx.fillStyle = '#4b555f';
  ctx.font = '24px Georgia, serif';
  ctx.fillText(`Depositado el ${formatDate(fear.created_at)}`, 75, y + 44);

  ctx.fillStyle = '#6b4f3a';
  ctx.font = '600 28px Georgia, serif';
  ctx.fillText(`Apoyos 🫂  ${fear.apoyos || 0}`, 75, y + 96);
  ctx.fillText(`Fuerzas 💪  ${fear.fuerzas || 0}`, 75, y + 140);

  ctx.textAlign = 'center';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#6b4f3a';
  ctx.fillText('Tu miedo importa. El archivo lo guarda.', W / 2, H - 64);

  return cv.toDataURL('image/png');
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

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

const cajonParam = new URLSearchParams(location.search).get('cajon');
if (cajonParam && GROUPS.includes(cajonParam)) {
  openDrawer(cajonParam);
}
