// Ficha de miedo compartida (archivo + portada) con reacciones y compartir en Bluesky.
// Definiciones globales: fearCardHTML, bindCardActions, escapeHtml, formatDate.

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

function fearCardHTML(fear, index = 0) {
  const anim = index ? ` style="animation-delay: ${index * 0.05}s"` : '';
  return `
    <article class="fear-card"${anim}>
      <p class="fear-text">${escapeHtml(fear.content)}</p>
      <span class="fear-topic">tema: ${escapeHtml(fear.topic || '—')}</span>
      <div class="fear-meta">
        <span class="fear-stamp">
          <span class="fear-stamp-line">Miedo Archivado</span>
          <span class="fear-stamp-line">N° ${fear.id} · ${formatDate(fear.created_at)}</span>
        </span>
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
        <button class="share-btn" data-id="${fear.id}" data-content="${escapeHtml(fear.content)}" data-date="${fear.created_at}" data-apoyos="${fear.apoyos ?? 0}" data-fuerzas="${fear.fuerzas ?? 0}" data-topic="${escapeHtml(fear.topic || '')}" aria-label="Compartir este miedo en Bluesky">
          Compartir en Bluesky ↗
        </button>
        <span class="share-note">Se publica de forma anónima en @archmiedos.bsky.social</span>
      </div>
    </article>
  `;
}

function bindCardActions(rootEl) {
  rootEl.addEventListener('click', async (e) => {
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
}

async function shareFear(btn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const original = btn.textContent;
  btn.textContent = 'Publicando en Bluesky...';

  try {
    let image = null;
    try {
      image = await renderFearCard({
        content: btn.dataset.content || '',
        created_at: btn.dataset.date || '',
        apoyos: btn.dataset.apoyos,
        fuerzas: btn.dataset.fuerzas,
        topic: btn.dataset.topic || '',
      });
    } catch {
      image = null;
    }
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

async function renderFearCard(fear) {
  await ensureFonts();
  const W = 1000;
  const RETRO = '"Special Elite", "Courier New", monospace';
  const BODY = '"Kalam", "Patrick Hand", "Comic Sans MS", cursive';

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `34px ${BODY}`;
  const allLines = wrapText(measure, String(fear.content || ''), W - 150);
  const maxLines = 10;
  const shown = allLines.slice(0, maxLines);
  const hasMore = allLines.length > maxLines;
  const minLines = 2;
  const usedLines = Math.max(shown.length + (hasMore ? 1 : 0), minLines);

  const lineH = 46;
  const contentTop = 256;
  const contentBottom = contentTop + usedLines * lineH + 18;
  const bottomStart = contentBottom + 26;
  const footerY = bottomStart + 182;
  const H = footerY + 32;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#faf5e9';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c9a227';
  for (let x = 0; x < W; x += 22) {
    ctx.fillRect(x, 0, 14, 16);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3526';
  ctx.font = `400 52px ${RETRO}`;
  ctx.fillText('Archivo de Miedos', W / 2, 122);
  ctx.fillStyle = '#6b4f3a';
  ctx.font = `400 24px ${RETRO}`;
  ctx.fillText('Est. 1950 · Departamento de Liberación Emocional', W / 2, 164);

  // Reglones de cuaderno (tenues) en el bloque del miedo
  ctx.strokeStyle = 'rgba(107, 79, 58, 0.14)';
  ctx.lineWidth = 2;
  for (let ry = contentTop; ry <= contentTop + usedLines * lineH; ry += lineH) {
    ctx.beginPath();
    ctx.moveTo(75, ry);
    ctx.lineTo(W - 75, ry);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.35)';
  ctx.beginPath();
  ctx.moveTo(62, contentTop - lineH / 2);
  ctx.lineTo(62, contentTop + usedLines * lineH + lineH / 2);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c2417';
  ctx.font = `400 34px ${BODY}`;
  let y = contentTop;
  shown.forEach((l) => {
    ctx.fillText(l, 75, y);
    y += lineH;
  });
  if (hasMore) ctx.fillText('…', 75, y);

  ctx.strokeStyle = '#e8dfc8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(75, bottomStart);
  ctx.lineTo(W - 75, bottomStart);
  ctx.stroke();

  drawRubberStamp(ctx, 220, bottomStart + 48, fear.id, formatDate(fear.created_at));

  ctx.fillStyle = '#6b4f3a';
  ctx.font = `400 32px ${RETRO}`;
  ctx.textAlign = 'left';
  ctx.fillText(`🫂 Apoyos: ${fear.apoyos || 0}`, 75, bottomStart + 122);
  ctx.textAlign = 'center';
  ctx.fillText(`Tema: ${fear.topic || '—'}`, W / 2, bottomStart + 122);
  ctx.textAlign = 'right';
  ctx.fillText(`💪 Fuerzas: ${fear.fuerzas || 0}`, W - 75, bottomStart + 122);

  ctx.textAlign = 'center';
  ctx.font = `400 24px ${RETRO}`;
  ctx.fillStyle = '#6b4f3a';
  ctx.fillText('Tu miedo importa. El archivo lo guarda.', W / 2, footerY);

  return cv.toDataURL('image/png');
}

async function ensureFonts() {
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.all([
        document.fonts.load('400 52px "Special Elite"'),
        document.fonts.load('400 34px "Kalam"'),
      ]);
      await document.fonts.ready;
    } catch {
      /* usar el fallback */
    }
  }
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
