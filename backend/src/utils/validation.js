export const MIN_LENGTH = 10;
export const MAX_LENGTH = 300;
export const RATE_LIMIT_PER_DAY = 5;

export const SEX_OPTIONS = ['hombre', 'mujer', 'otro'];
export const AGE_GROUPS = ['0-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90+'];

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

// Datos opcionales del formulario: vacío o inválido => null (se guarda sin clasificar).
export function normalizeSex(value) {
  return typeof value === 'string' && SEX_OPTIONS.includes(value) ? value : null;
}

export function normalizeAgeGroup(value) {
  return typeof value === 'string' && AGE_GROUPS.includes(value) ? value : null;
}

export function normalizeCountry(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return code.toUpperCase();
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
