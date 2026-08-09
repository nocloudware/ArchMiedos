const input = document.getElementById('fear-input');
const counter = document.getElementById('char-count');
const btn = document.getElementById('submit-btn');
const message = document.getElementById('form-message');

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

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
      body: JSON.stringify({ content }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || 'Algo salió mal al depositar tu miedo.', 'error');
    } else {
      showMessage(data.message, 'success');
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

function showMessage(text, type) {
  message.textContent = text;
  message.className = `form-message ${type}`;
}
