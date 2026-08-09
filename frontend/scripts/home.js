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

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL');
}

document.addEventListener('DOMContentLoaded', loadHomeStats);
