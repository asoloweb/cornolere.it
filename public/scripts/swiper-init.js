function loadSwiperScript() {
  if (window.Swiper) return Promise.resolve();

  const existing = document.querySelector('script[data-swiper-vendor="true"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed loading Swiper')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/swiper-bundle.min.js';
    script.defer = true;
    script.dataset.swiperVendor = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed loading Swiper'));
    document.head.appendChild(script);
  });
}

function attachSliderClickHandler(el) {
  if (el.getAttribute('data-slider-click-bound') === 'true') return;
  el.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const clickable = target.closest('[data-href]');
    if (!(clickable instanceof HTMLElement)) return;
    const href = clickable.getAttribute('data-href');
    if (href) {
      window.location.href = href;
    }
  });
  el.setAttribute('data-slider-click-bound', 'true');
}

document.addEventListener('DOMContentLoaded', async () => {
  const allSliders = Array.from(document.querySelectorAll('.slider_block.swiper'));
  if (allSliders.length === 0) return;

  allSliders.forEach((el) => attachSliderClickHandler(el));

  const slidersToInit = allSliders.filter(
    (el) => el.getAttribute('data-swiper-enabled') === 'true'
  );
  if (slidersToInit.length === 0) return;

  try {
    await loadSwiperScript();
  } catch (error) {
    console.error('Errore caricando swiper', error);
    return;
  }

  if (!window.Swiper) return;

  slidersToInit.forEach((el) => {
    if (el.getAttribute('data-swiper-initialized') === 'true') return;

    const nextEl = el.querySelector('.swiper-button-next');
    const prevEl = el.querySelector('.swiper-button-prev');
    const paginationEl = el.querySelector('.swiper-pagination');

    const options = {
      loop: true,
      speed: 500,
      slidesPerView: 1,
      spaceBetween: 20,
      watchOverflow: false,
    };

    if (el.classList.contains('google_reviews_slider')) {
      options.autoHeight = true;
      options.slidesPerView = 1;
      options.slidesPerGroup = 1;
      options.autoplay = {
        delay: 3200,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      };
      options.breakpoints = {
        640: {
          slidesPerView: 2,
          slidesPerGroup: 1,
          spaceBetween: 20,
        },
        900: {
          slidesPerView: 3,
          slidesPerGroup: 1,
          spaceBetween: 24,
        },
      };
    }

    if (paginationEl) {
      options.pagination = { el: paginationEl, clickable: true };
    }
    if (nextEl && prevEl) {
      options.navigation = { nextEl, prevEl };
    }

    try {
      new window.Swiper(el, options);
      el.setAttribute('data-swiper-initialized', 'true');
    } catch (error) {
      console.error('Errore inizializzando swiper', error);
    }
  });
});
