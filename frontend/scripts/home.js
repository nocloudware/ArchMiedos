// Portada: contador, último miedo y miedo al azar.
// El certificado vive en card.js (cada tarjeta tiene "Obtener certificado").

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL');
}

// ---------- Contador ----------
async function loadHomeStats() {
  const el = document.getElementById('home-stats');
  if (!el) return;
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    el.innerHTML = `
      <div class="home-stat"><span class="home-stat-value">${fmt(s.fears)}</span><span class="home-stat-label">miedos</span></div>
      <div class="home-stat"><span class="home-stat-value">${fmt(s.apoyos)}</span><span class="home-stat-label">apoyos 🫂</span></div>
      <div class="home-stat"><span class="home-stat-value">${fmt(s.fuerzas)}</span><span class="home-stat-label">fuerzas 💪</span></div>`;
  } catch {
    el.hidden = true;
  }
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
