export const MIN_LENGTH = 10;
export const MAX_LENGTH = 2000;
export const RATE_LIMIT_PER_DAY = 5;

export function validateContent(content) {
  if (typeof content !== 'string') {
    return { ok: false, error: 'El contenido debe ser texto' };
  }
  const trimmed = content.trim();
  if (trimmed.length < MIN_LENGTH) {
    return { ok: false, error: `El miedo debe tener al menos ${MIN_LENGTH} caracteres` };
  }
  if (trimmed.length > MAX_LENGTH) {
    return { ok: false, error: `El miedo no puede superar los ${MAX_LENGTH} caracteres` };
  }
  return { ok: true, value: trimmed };
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function parseLetterRange(param) {
  if (!param) return { ok: true, from: null, to: null };
  const single = param.toUpperCase().match(/^[A-Z]$/);
  if (single) return { ok: true, from: single[0], to: single[0] };
  const range = param.toUpperCase().match(/^([A-Z])-([A-Z])$/);
  if (range && range[1] <= range[2]) return { ok: true, from: range[1], to: range[2] };
  return { ok: false, error: 'Parámetro letter inválido' };
}

export function clamp(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
