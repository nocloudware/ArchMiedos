const STATUS_LABELS = {
  pending: 'Pendientes',
  approved: 'Aprobados',
  rejected: 'Rechazados',
  reported: 'Reportados',
  all: 'Todos',
};

let currentStatus = 'pending';

const navButtons = document.querySelectorAll('.nav-item[data-status]');
const tbody = document.getElementById('fears-tbody');
const fearsEmpty = document.getElementById('fears-empty');
const titleEl = document.getElementById('admin-title');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatus = btn.dataset.status;
    titleEl.textContent = STATUS_LABELS[currentStatus];
    loadFears(currentStatus);
  });
});

document.getElementById('fears-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-mini');
  if (!btn || btn.disabled) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete' && !confirm('¿Eliminar este miedo permanentemente?')) return;

  btn.disabled = true;
  try {
    if (action === 'approve' || action === 'reject') {
      await fetch(`/api/admin/fears/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
      });
    } else {
      await fetch(`/api/admin/fears/${id}`, { method: 'DELETE' });
    }
    loadFears(currentStatus);
    loadStats();
  } catch {
    btn.disabled = false;
  }
});

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) return;
    const data = await res.json();
    renderStats(data);
    renderTop(data.topLiked || []);
    renderActivity(data.activity || []);
  } catch {
    /* sin cambios */
  }
}

function renderStats(s) {
  const cards = [
    ['Total', s.total],
    ['Pendientes', s.pending],
    ['Aprobados', s.approved],
    ['Rechazados', s.rejected],
    ['Reportados', s.reported],
    ['Apoyos', s.totalLikes],
  ];
  document.getElementById('stats-dashboard').innerHTML = cards
    .map(
      ([label, value]) => `
      <div class="stat-card">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>`
    )
    .join('');
}

function renderTop(items) {
  const el = document.getElementById('top-liked');
  if (!items.length) {
    el.innerHTML = '<li class="empty-note">Sin miedos populares aún.</li>';
    return;
  }
  el.innerHTML = items
    .map(
      (f) => `
      <li>${escapeHtml(f.content.slice(0, 60))}${f.content.length > 60 ? '…' : ''}
        <span class="top-likes">— ${f.likes} apoyo${f.likes === 1 ? '' : 's'}</span>
      </li>`
    )
    .join('');
}

function renderActivity(items) {
  const el = document.getElementById('activity-chart');
  if (!items.length) {
    el.innerHTML = '<span class="empty-note">Sin actividad esta semana.</span>';
    return;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  el.innerHTML = items
    .map((i) => {
      const h = Math.max(4, Math.round((i.count / max) * 100));
      return `<div class="activity-bar" style="height:${h}%" title="${i.day}: ${i.count}">
        <span class="bar-label">${i.day.slice(5)}</span>
      </div>`;
    })
    .join('');
}

async function loadFears(status) {
  try {
    const res = await fetch(`/api/admin/fears?status=${status}&limit=100`);
    if (!res.ok) return;
    const data = await res.json();

    if (!data.items.length) {
      tbody.innerHTML = '';
      fearsEmpty.hidden = false;
      return;
    }
    fearsEmpty.hidden = true;
    tbody.innerHTML = data.items.map((f) => rowHTML(f)).join('');
  } catch {
    /* sin cambios */
  }
}

function rowHTML(f) {
  const reportNote = f.is_reported ? '<span class="report-reason">⚠ Reportado por usuarios</span>' : '';
  const badges = [f.status];
  if (f.is_reported) badges.push('reported');

  return `
    <tr>
      <td class="cell-muted">#${f.id}</td>
      <td class="cell-fear">${escapeHtml(f.content)}${reportNote}</td>
      <td class="cell-muted">${formatDate(f.created_at)}</td>
      <td>${f.likes}</td>
      <td>${badges.map((b) => `<span class="badge ${b}">${b}</span>`).join(' ')}</td>
      <td>
        <div class="row-actions">
          ${f.status !== 'approved' ? `<button class="btn-mini approve" data-action="approve" data-id="${f.id}">Aprobar</button>` : ''}
          ${f.status !== 'rejected' ? `<button class="btn-mini reject" data-action="reject" data-id="${f.id}">Rechazar</button>` : ''}
          <button class="btn-mini danger" data-action="delete" data-id="${f.id}">Eliminar</button>
        </div>
      </td>
    </tr>
  `;
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

loadStats();
loadFears('pending');
