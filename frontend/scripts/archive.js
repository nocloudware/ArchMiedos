const GROUPS = ['A-C', 'D-F', 'G-I', 'J-L', 'M-O', 'P-R', 'S-U', 'V-X', 'Y-Z'];

const cabinetsEl = document.getElementById('cabinets');
const modal = document.getElementById('drawer-modal');
const cardsEl = document.getElementById('cards-container');
const searchInput = document.getElementById('drawer-search');
const drawerTotal = document.querySelector('[data-drawer-total]');
const drawerLetters = document.querySelector('[data-drawer-letters]');
const archiveEmpty = document.getElementById('archive-empty');

let currentGroup = null;
let searchTimer = null;

function buildCabinets() {
  cabinetsEl.innerHTML = GROUPS.map(
    (g) => `
    <div class="filing-cabinet" data-group="${g}" role="button" tabindex="0" aria-label="Abrir archivo ${g}">
      <div class="cabinet-frame">
        <div class="cabinet-top"></div>
        <div class="drawer">
          <div class="drawer-handle"></div>
          <div class="drawer-label">${g}</div>
          <div class="drawer-count">…</div>
        </div>
      </div>
      <div class="cabinet-shadow"></div>
    </div>
  `
  ).join('');
}

async function loadCounts() {
  const totals = await Promise.all(
    GROUPS.map(async (g) => {
      try {
        const res = await fetch(`/api/fears?letter=${encodeURIComponent(g)}&limit=1`);
        const data = await res.json();
        return data.total || 0;
      } catch {
        return 0;
      }
    })
  );

  GROUPS.forEach((g, i) => {
    const el = cabinetsEl.querySelector(`[data-group="${g}"] .drawer-count`);
    el.textContent = `${totals[i]} miedo${totals[i] === 1 ? '' : 's'}`;
  });

  archiveEmpty.hidden = totals.some((t) => t > 0);
}

function openDrawer(group) {
  currentGroup = group;
  drawerLetters.textContent = group;
  searchInput.value = '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setActiveCabinet(group);
  history.replaceState(null, '', `${location.pathname}?cajon=${encodeURIComponent(group)}`);
  loadFears(group, '');
}

function closeDrawer() {
  modal.hidden = true;
  document.body.style.overflow = '';
  setActiveCabinet(null);
  history.replaceState(null, '', location.pathname);
}

function setActiveCabinet(group) {
  document.querySelectorAll('.side-tab.cab').forEach((el) => {
    el.classList.toggle('active', el.dataset.group === group);
  });
}

async function loadFears(group, query) {
  cardsEl.innerHTML = '<p class="loading-note">Abriendo el cajón...</p>';
  drawerTotal.textContent = '…';

  const url = query
    ? `/api/fears/search?q=${encodeURIComponent(query)}&limit=50`
    : `/api/fears?letter=${encodeURIComponent(group)}&limit=50`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    drawerTotal.textContent = data.total ?? 0;

    if (!data.items || data.items.length === 0) {
      cardsEl.innerHTML =
        '<p class="loading-note">Este cajón está vacío. Sé el primero en depositar un miedo.</p>';
      carouselState = null;
      return;
    }

    cardsEl.innerHTML = `
      <div class="carousel">
        <button class="carousel-arrow prev" type="button" aria-label="Miedo anterior">‹</button>
        <div class="carousel-viewport">
          <div class="carousel-track">
            ${data.items.map((fear, i) => `<div class="carousel-slide">${cardHTML(fear, i)}</div>`).join('')}
          </div>
        </div>
        <button class="carousel-arrow next" type="button" aria-label="Miedo siguiente">›</button>
      </div>`;
    initCarousel();
  } catch {
    cardsEl.innerHTML = '<p class="loading-note">No se pudo abrir el cajón. Inténtalo de nuevo.</p>';
    carouselState = null;
  }
}

// ---------- Carrusel infinito ----------
let carouselState = null;

function initCarousel() {
  const carousel = cardsEl.querySelector('.carousel');
  if (!carousel) return;
  const viewport = carousel.querySelector('.carousel-viewport');
  const track = carousel.querySelector('.carousel-track');
  const prevBtn = carousel.querySelector('.carousel-arrow.prev');
  const nextBtn = carousel.querySelector('.carousel-arrow.next');
  const slides = Array.from(track.children);
  const count = slides.length;
  if (count === 0) return;

  if (count <= 1) {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    carouselState = null;
    return;
  }

  const first = slides[0];
  const last = slides[count - 1];
  track.appendChild(first.cloneNode(true));
  track.insertBefore(last.cloneNode(true), first);
  const total = count + 2;
  let current = 1;

  const slideWidth = () => slides[0].getBoundingClientRect().width || viewport.clientWidth;

  const move = (index) => {
    track.style.transform = `translateX(-${index * slideWidth()}px)`;
    current = index;
  };
  const jump = (index) => {
    track.classList.add('no-anim');
    track.style.transform = `translateX(-${index * slideWidth()}px)`;
    void track.offsetWidth;
    track.classList.remove('no-anim');
    current = index;
  };
  const onTransitionEnd = () => {
    if (current === 0) jump(count);
    else if (current === total - 1) jump(1);
  };
  const go = (delta) => move(current + delta);

  track.addEventListener('transitionend', onTransitionEnd);
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  let startX = null;
  viewport.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  viewport.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  });
  viewport.addEventListener('pointercancel', () => { startX = null; });

  carouselState = { move, go, current: () => current };
  jump(1);
}

window.addEventListener('resize', () => {
  if (carouselState) carouselState.move(carouselState.current());
});

document.addEventListener('keydown', (e) => {
  if (modal.hidden || !carouselState) return;
  if (e.key === 'ArrowLeft') {
    carouselState.go(-1);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    carouselState.go(1);
    e.preventDefault();
  }
});

function cardHTML(fear, index) {
  return fearCardHTML(fear, index);
}

cabinetsEl.addEventListener('click', (e) => {
  const cabinet = e.target.closest('.filing-cabinet');
  if (cabinet) openDrawer(cabinet.dataset.group);
});

cabinetsEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const cabinet = e.target.closest('.filing-cabinet');
    if (cabinet) {
      e.preventDefault();
      openDrawer(cabinet.dataset.group);
    }
  }
});

document.querySelectorAll('[data-close-drawer]').forEach((el) => {
  el.addEventListener('click', closeDrawer);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeDrawer();
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  searchTimer = setTimeout(() => loadFears(currentGroup, q), 300);
});

bindCardActions(cardsEl);

buildCabinets();
loadCounts();

const cajonParam = new URLSearchParams(location.search).get('cajon');
if (cajonParam && GROUPS.includes(cajonParam)) {
  openDrawer(cajonParam);
}
