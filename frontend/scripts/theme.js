// Tema claro/oscuro: persistente en localStorage, default = preferencia del sistema.
// Se carga SÍNCRONO en <head> (antes del primer paint) para que data-theme ya esté
// aplicado cuando el CSS pinta, sin parpadeo. La CSP no permite inline scripts.
const THEME_KEY = 'am.theme';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;

const systemTheme = () => (mq.matches ? 'dark' : 'light');

function storedTheme() {
  const s = localStorage.getItem(THEME_KEY);
  return s === 'light' || s === 'dark' ? s : null;
}

const effectiveTheme = () => storedTheme() || systemTheme();

function apply(theme) {
  root.setAttribute('data-theme', theme);
  const dark = theme === 'dark';
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.querySelector('.theme-sun').hidden = !dark;
    btn.querySelector('.theme-moon').hidden = dark;
    const label = btn.querySelector('.theme-label');
    if (label) label.textContent = dark ? 'Claro' : 'Oscuro';
    btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  });
}

apply(effectiveTheme());

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.setItem(THEME_KEY, effectiveTheme() === 'dark' ? 'light' : 'dark');
      apply(effectiveTheme());
    });
  });
});

// Si el usuario no eligió tema explícito, sigue en vivo al sistema.
const onSystemChange = () => {
  if (!storedTheme()) apply(systemTheme());
};
if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
else mq.addListener(onSystemChange);
