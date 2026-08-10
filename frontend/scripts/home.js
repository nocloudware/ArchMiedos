const GROUPS = ['A-C', 'D-F', 'G-I', 'J-L', 'M-O', 'P-R', 'S-U', 'V-X', 'Y-Z'];

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

function groupOfLetter(letter) {
  const L = String(letter || '').toUpperCase();
  return GROUPS.find((g) => L >= g[0] && L <= g[2]) || 'A-C';
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

function fmt(n) {
  return Number(n || 0).toLocaleString('es-CL');
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

// ---------- Mi miedo (cookie am_mine) ----------
const mineSection = document.getElementById('home-mine');
let myFear = null;

function readMineCookie() {
  const raw = document.cookie.split(';').find((c) => c.trim().startsWith('am_mine='));
  if (!raw) return [];
  try {
    return decodeURIComponent(raw.split('=').slice(1).join('=')).split(',').filter(Boolean);
  } catch {
    return [];
  }
}

async function loadMine() {
  const ids = readMineCookie();
  if (!ids.length) return;
  try {
    const res = await fetch(`/api/fears/${ids[0]}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.item) return;
    myFear = data.item;
    const group = groupOfLetter(myFear.topic_letter);
    document.getElementById('home-mine-text').textContent = `Depositaste: "${myFear.content}"`;
    const link = document.getElementById('home-mine-link');
    link.href = `/archive.html?cajon=${encodeURIComponent(group)}`;
    link.textContent = `Verlo en el cajón ${group}`;
    mineSection.hidden = false;
  } catch {
    /* sin panel */
  }
}

// ---------- Certificado ----------
const certBtn = document.getElementById('cert-btn');
if (certBtn) certBtn.addEventListener('click', downloadCertificate);

function downloadCertificate() {
  if (!myFear) return;
  const W = 1200;
  const H = 900;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#faf5e9';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#6b4f3a';
  ctx.lineWidth = 14;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3526';
  ctx.font = '600 56px Georgia, serif';
  ctx.fillText('Certificado de Superación', W / 2, 150);

  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText('El Archivo de Miedos certifica que este miedo fue depositado:', W / 2, 235);

  ctx.font = 'italic 34px Georgia, serif';
  const lines = wrapText(ctx, `«${myFear.content}»`, W - 200);
  let y = 330;
  lines.forEach((l) => {
    ctx.fillText(l, W / 2, y);
    y += 48;
  });

  ctx.font = '28px Georgia, serif';
  ctx.fillText('Fue escrito, archivado y compartido en comunidad.', W / 2, y + 40);
  ctx.fillText(`Fecha: ${formatDate(myFear.created_at)}`, W / 2, y + 90);

  ctx.font = '600 30px Georgia, serif';
  ctx.fillStyle = '#6b4f3a';
  ctx.fillText('— Archivo de Miedos · Est. 1950 —', W / 2, y + 170);

  drawRubberStamp(ctx, 186, H - 90, myFear.id, formatDate(myFear.created_at));

  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = 'certificado-de-superacion.png';
  a.click();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
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

// Timbre de goma en verde suave, inclinado, con correlativo y fecha.
function drawRubberStamp(ctx, cx, cy, num, date) {
  const SW = 300;
  const SH = 80;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.05);
  ctx.strokeStyle = 'rgba(62, 142, 90, 0.7)';
  ctx.fillStyle = 'rgba(62, 142, 90, 0.08)';
  ctx.lineWidth = 4;
  roundRect(ctx, -SW / 2, -SH / 2, SW, SH, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(52, 122, 78, 0.9)';
  ctx.textAlign = 'center';
  ctx.font = '400 26px "Special Elite", "Courier New", monospace';
  ctx.fillText('Miedo Archivado', 0, -12);
  ctx.font = '400 19px "Special Elite", "Courier New", monospace';
  ctx.fillText(`N° ${num} · ${date}`, 0, 22);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------- Service worker (PWA) ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeStats();
  loadFear('/api/fears/latest');
  loadMine();
});
