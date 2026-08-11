const input = document.getElementById('fear-input');
const counter = document.getElementById('char-count');
const btn = document.getElementById('submit-btn');
const message = document.getElementById('form-message');
const sexEl = document.getElementById('fear-sex');
const ageEl = document.getElementById('fear-age');
const countryInput = document.getElementById('fear-country');
const countryCode = document.getElementById('fear-country-code');
const countryDropdown = document.getElementById('country-dropdown');

const MIN_LENGTH = 10;
const MAX_LENGTH = 300;

// Combobox de país: escribe para filtrar la lista; al elegir se guarda el código ISO2.
if (countryInput && countryCode && countryDropdown && typeof COUNTRIES !== 'undefined') {
  const COUNTRY_KEYS = Object.keys(COUNTRIES).sort((a, b) =>
    COUNTRIES[a].localeCompare(COUNTRIES[b], 'es')
  );

  function renderCountryOptions(q) {
    const query = (q || '').trim().toLowerCase();
    const matches = query
      ? COUNTRY_KEYS.filter((c) => COUNTRIES[c].toLowerCase().includes(query) || c.toLowerCase() === query)
      : COUNTRY_KEYS;
    countryDropdown.innerHTML = matches.length
      ? matches
          .map((c) => `<button type="button" class="country-option" data-code="${c}">${countryFlag(c)} ${COUNTRIES[c]}</button>`)
          .join('')
      : '<div class="country-empty">Sin coincidencias</div>';
  }

  countryInput.addEventListener('input', () => {
    const v = countryInput.value.trim();
    countryCode.value =
      /^[A-Za-z]{2}$/.test(v) || COUNTRY_KEYS.some((c) => COUNTRIES[c].toLowerCase() === v.toLowerCase())
        ? (v.length === 2 ? v.toUpperCase() : COUNTRY_KEYS.find((c) => COUNTRIES[c].toLowerCase() === v.toLowerCase()))
        : '';
    renderCountryOptions(v);
    countryDropdown.hidden = false;
  });

  countryInput.addEventListener('focus', () => {
    if (!countryInput.value.trim()) renderCountryOptions('');
    countryDropdown.hidden = false;
  });

  countryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') countryDropdown.hidden = true;
  });

  countryDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.country-option');
    if (!opt) return;
    const code = opt.dataset.code;
    countryCode.value = code;
    countryInput.value = COUNTRIES[code];
    countryDropdown.hidden = true;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.country-picker')) countryDropdown.hidden = true;
  });
}

input.addEventListener('input', () => {
  counter.textContent = `${input.value.length} / ${MAX_LENGTH}`;
  counter.classList.toggle('warn', input.value.length >= MAX_LENGTH - 100);
});

btn.addEventListener('click', async () => {
  const content = input.value.trim();

  if (content.length < MIN_LENGTH) {
    showMessage(`El miedo debe tener al menos ${MIN_LENGTH} caracteres.`, 'error');
    input.focus();
    return;
  }

  btn.disabled = true;
  showMessage('Depositando tu miedo en el archivo...', '');

  try {
    const res = await fetch('/api/fears', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sex: sexEl?.value || null,
        ageGroup: ageEl?.value || null,
        country: countryCode?.value || null,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(escapeHtml(data.error || 'Algo salió mal al depositar tu miedo.'), 'error');
    } else {
      let html = escapeHtml(data.message);
      const c = data.classification;
      if (c && c.group) {
        html +=
          `<br /><span class="classify-note">Quedó en el cajón <strong>${escapeHtml(c.group)}</strong> · ` +
          `tema: <strong>${escapeHtml(c.topic)}</strong>. La IA identificó que el centro de tu miedo es ` +
          `${escapeHtml(c.topic)}.</span>`;
      }
      showMessage(html, 'success');
      input.value = '';
      counter.textContent = `0 / ${MAX_LENGTH}`;
      counter.classList.remove('warn');
    }
  } catch {
    showMessage('No se pudo conectar con el archivo. Inténtalo de nuevo.', 'error');
  } finally {
    btn.disabled = false;
  }
});

function showMessage(html, type) {
  message.innerHTML = html;
  message.className = `form-message ${type}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
