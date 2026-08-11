// Portada: contador, último miedo y miedo al azar.
// El certificado vive en card.js (cada tarjeta tiene "Obtener certificado").

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL');
}

const AGE_LABELS = {
  '0-19': '0-19',
  '20-29': '20-29',
  '30-39': '30-39',
  '40-49': '40-49',
  '50-59': '50-59',
  '60-69': '60-69',
  '70-79': '70-79',
  '80-89': '80-89',
  '90+': '90+ ∞',
};

// ---------- Contador ----------
async function loadHomeStats() {
  const el = document.getElementById('home-stats');
  const demoEl = document.getElementById('home-demographics');
  if (!el || !demoEl) return;
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    el.innerHTML = `
      <div class="home-stat"><span class="home-stat-value">${fmt(s.fears)}</span><span class="home-stat-label">miedos</span></div>
      <div class="home-stat"><span class="home-stat-value">${fmt(s.apoyos)}</span><span class="home-stat-label">apoyos 🫂</span></div>
      <div class="home-stat"><span class="home-stat-value">${fmt(s.fuerzas)}</span><span class="home-stat-label">fuerzas 💪</span></div>`;
    demoEl.innerHTML = demographicsHTML(s.demographics);
  } catch {
    el.hidden = true;
    demoEl.hidden = true;
  }
}

function demographicsHTML(d) {
  const sex = d?.sex || {};
  const age = d?.age || [];
  const countries = d?.countries || [];
  return `
    <div class="demo-col">
      <span class="demo-title">Sexo</span>
      ${demoRow('Hombres', sex.hombres ?? 0)}
      ${demoRow('Mujeres', sex.mujeres ?? 0)}
      ${demoRow('Otro', sex.otro ?? 0)}
      ${demoRow('S/C', sex.sinClasificar ?? 0)}
    </div>
    <div class="demo-col">
      <span class="demo-title">Países</span>
      <div class="demo-list">
        ${countries.length
          ? countries.map((c) => demoRow(`${countryFlag(c.code)} ${countryName(c.code) || c.code}`, c.count)).join('')
          : '<span class="demo-empty">Sin datos</span>'}
      </div>
    </div>
    <div class="demo-col">
      <span class="demo-title">Edad</span>
      <div class="demo-list">
        ${age.length
          ? age.map((a) => demoRow(AGE_LABELS[a.group] || a.group, a.count)).join('')
          : '<span class="demo-empty">Sin datos</span>'}
      </div>
    </div>`;
}

function demoRow(label, count) {
  return `<span class="demo-row"><span>${label}</span><b>${count}</b></span>`;
}

// ---------- Del archivo: último + aleatorio ----------
const fearCard = document.getElementById('home-fear-card');
const randomBtn = document.getElementById('random-btn');

async function loadFear(url) {
  fearCard.innerHTML = '<p class="loading-note">Abriendo un cajón...</p>';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const item = data.item || (data.items && data.items[0]);
    if (!item) {
      fearCard.innerHTML = '<p class="empty-note">El archivo aún está vacío. Sé la primera persona en depositar un miedo.</p>';
      return;
    }
    fearCard.innerHTML = fearCardHTML(item, 0);
  } catch {
    fearCard.innerHTML = '<p class="empty-note">No se pudo abrir el archivo. Inténtalo de nuevo.</p>';
  }
}

if (randomBtn) randomBtn.addEventListener('click', () => loadFear('/api/fears/random'));

bindCardActions(fearCard);

// ---------- Service worker (PWA) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeStats();
  loadFear('/api/fears/latest');
});
