const toggle = document.getElementById('nav-toggle');
const backdrop = document.getElementById('nav-backdrop');
const nav = document.querySelector('.side-nav');

if (toggle && backdrop && nav) {
  const isOpen = () => nav.classList.contains('open');

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    backdrop.hidden = !open;
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  backdrop.addEventListener('click', () => setOpen(false));

  nav.querySelectorAll('.side-tab').forEach((el) => {
    el.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 899) setOpen(false);
  });
}
