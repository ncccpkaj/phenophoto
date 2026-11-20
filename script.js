(() => {
  const weddingFiles = [...Array.from({ length: 32 }, (_, i) => `image/gallery/wedding/${String(i + 1).padStart(2, '0')}.png`), ...[33, 34, 35, 36].map(i => `image/gallery/wedding/${i}.jpeg`), ...Array.from({ length: 17 }, (_, i) => `image/gallery/wedding/${String(i + 37).padStart(2, '0')}.png`)];
  const foodFiles = ['01.png','02.png','03.png','04.jpg','05.jpg','06.jpg','07.jpg','08.png','09.jpg','10.png','11.png','12.png','13.png','14.png','15.png'].map(name => `image/gallery/food/${name}`);
  const galleries = {
    wedding: weddingFiles.map((src, index) => ({ src, alt: `Wedding photography, photograph ${index + 1}` })),
    food: foodFiles.map((src, index) => ({ src, alt: `Food photography, photograph ${index + 1}` }))
  };

  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const themeButton = document.querySelector('.theme-toggle');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const bookingDialog = document.querySelector('.booking-dialog');
  const lightbox = document.querySelector('.lightbox-dialog');
  let activeGallery = 'wedding';
  const visibleCounts = { wedding: 8, food: 8 };
  let lightboxIndex = 0;
  let heroIndex = 0;
  let galleryResizeFrame = 0;

  // Keep the selected color theme between visits.
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('phenophoto-theme'); } catch (_) {}
  let userSelectedTheme = savedTheme === 'dark' || savedTheme === 'light';
  root.dataset.theme = userSelectedTheme ? savedTheme : (systemTheme.matches ? 'dark' : 'light');
  const updateThemeLabel = () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    themeButton.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
    document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#191918' : '#f7f5f0';
  };
  updateThemeLabel();
  themeButton.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    userSelectedTheme = true;
    updateThemeLabel();
    try { localStorage.setItem('phenophoto-theme', root.dataset.theme); } catch (_) {}
  });
  systemTheme.addEventListener?.('change', event => {
    if (userSelectedTheme) return;
    root.dataset.theme = event.matches ? 'dark' : 'light';
    updateThemeLabel();
  });

  // The fixed navigation gains its paper backdrop once the hero scrolls away.
  const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 30);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  // Scroll to sections without adding a hash to the address bar.
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-scroll], [data-scroll-to]');
    if (!trigger) return;
    const id = trigger.dataset.scrollTo || trigger.getAttribute('href')?.replace(/^#/, '');
    const destination = id === 'top' ? document.body : document.getElementById(id);
    if (!destination) return;
    event.preventDefault();
    destination.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    closeMenu();
  });

  function closeMenu() {
    if (nav.classList.contains('is-open')) {
      nav.classList.add('is-closing');
      const finishClose = event => {
        if (event.target !== nav || event.propertyName !== 'transform') return;
        if (nav.classList.contains('is-closing')) nav.classList.remove('is-open', 'is-closing');
        nav.removeEventListener('transitionend', finishClose);
      };
      nav.addEventListener('transitionend', finishClose);
    }
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    if (open) {
      nav.classList.remove('is-closing');
      nav.classList.add('is-open');
      menuButton.setAttribute('aria-expanded', 'true');
      menuButton.setAttribute('aria-label', 'Close menu');
    } else closeMenu();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); });

  // Reveal content as it enters the viewport, with a reduced-motion fallback.
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(item => revealObserver.observe(item));
  } else revealItems.forEach(item => item.classList.add('is-visible'));

  // Change the hero photograph gently, pausing automatic motion for reduced-motion users.
  const heroSlides = [...document.querySelectorAll('.hero-slide')];
  const heroSlideButtons = [...document.querySelectorAll('.hero-slide-button')];
  function showHero(index) {
    heroIndex = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((slide, slideIndex) => {
      const active = slideIndex === heroIndex;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    heroSlideButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === heroIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', String(active));
    });
  }
  heroSlideButtons.forEach(button => button.addEventListener('click', () => showHero(Number(button.dataset.slide))));
  if (heroSlides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => showHero(heroIndex + 1), 6500);

  // Build justified photo rows using each image's actual aspect ratio.
  function updateGalleryRows(grid) {
    const width = grid.clientWidth;
    if (!width) return;
    const mobile = window.innerWidth < 760;
    const columns = mobile ? 2 : window.innerWidth < 1100 ? 3 : 4;
    const gap = mobile ? 5 : 8;
    const items = [...grid.querySelectorAll('.gallery-item')];
    grid.querySelectorAll('.gallery-row').forEach(row => row.remove());
    for (let start = 0; start < items.length; start += columns) {
      const rowItems = items.slice(start, start + columns);
      const ratios = rowItems.map(item => Number(item.dataset.ratio) || 1);
      const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0);
      const available = width - gap * (rowItems.length - 1);
      const isLastPartialRow = rowItems.length < columns;
      const idealHeight = available / ratioSum;
      const rowHeight = isLastPartialRow
        ? (mobile ? 118 : 180)
        : Math.min(mobile ? 160 : 240, Math.max(mobile ? 105 : 145, idealHeight));
      const row = document.createElement('div');
      row.className = `gallery-row${isLastPartialRow ? ' gallery-row-last' : ''}`;
      row.style.height = `${rowHeight}px`;
      rowItems.forEach((item, index) => {
        item.style.flexGrow = isLastPartialRow ? '0' : String(ratios[index]);
        item.style.flexBasis = `${ratios[index] * rowHeight}px`;
        item.style.height = '100%';
        row.append(item);
      });
      grid.append(row);
    }
  }

  function renderGallery(category) {
    const items = galleries[category];
    const grid = document.querySelector(`#${category}-gallery-grid`);
    const loadButton = document.querySelector(`.gallery-load-more[data-gallery="${category}"]`);
    const visible = items.slice(0, visibleCounts[category]);
    grid.replaceChildren();
    visible.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-item';
      button.setAttribute('aria-label', `View ${photo.alt}`);
      button.dataset.index = String(index);
      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = photo.alt;
      image.loading = index < 8 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', () => {
        button.dataset.ratio = String(image.naturalWidth / image.naturalHeight || 1);
        button.classList.add('is-loaded');
        scheduleGalleryLayout();
      }, { once: true });
      image.addEventListener('error', () => {
        button.dataset.ratio = '1';
        button.classList.add('is-loaded');
        button.classList.add('image-missing');
        scheduleGalleryLayout();
      }, { once: true });
      button.dataset.ratio = '1';
      button.append(image);
      if (image.complete && image.naturalWidth) {
        button.dataset.ratio = String(image.naturalWidth / image.naturalHeight || 1);
        button.classList.add('is-loaded');
      }
      button.addEventListener('click', () => { activeGallery = category; openLightbox(index); });
      grid.append(button);
    });
    const remaining = items.length - visibleCounts[category];
    loadButton.hidden = remaining <= 0;
    loadButton.textContent = `Load ${Math.min(8, remaining)} more`;
    document.querySelector(`#${category}-gallery-progress`).textContent = `Showing ${visible.length} of ${items.length}`;
    requestAnimationFrame(() => updateGalleryRows(grid));
  }
  function scheduleGalleryLayout() {
    cancelAnimationFrame(galleryResizeFrame);
    galleryResizeFrame = requestAnimationFrame(() => {
      document.querySelectorAll('.gallery-grid').forEach(updateGalleryRows);
    });
  }
  Object.keys(galleries).forEach(renderGallery);
  document.querySelectorAll('.gallery-load-more').forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.gallery;
    visibleCounts[category] = Math.min(visibleCounts[category] + 8, galleries[category].length);
    renderGallery(category);
  }));
  window.addEventListener('resize', scheduleGalleryLayout, { passive: true });

  // Full-screen gallery viewer supports buttons, Escape and arrow keys.
  function openLightbox(index) {
    lightboxIndex = index;
    showLightboxPhoto();
    lightbox.showModal();
    document.body.classList.add('dialog-open');
  }
  function showLightboxPhoto() {
    const photos = galleries[activeGallery];
    const photo = photos[lightboxIndex];
    lightbox.querySelector('.lightbox-image').src = photo.src;
    lightbox.querySelector('.lightbox-image').alt = photo.alt;
    lightbox.querySelector('.lightbox-caption').textContent = activeGallery === 'food' ? 'Food photography' : 'Wedding photography';
    lightbox.querySelector('.lightbox-counter').textContent = `${String(lightboxIndex + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
  }
  function stepLightbox(step) {
    lightboxIndex = (lightboxIndex + step + galleries[activeGallery].length) % galleries[activeGallery].length;
    showLightboxPhoto();
  }
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => stepLightbox(-1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => stepLightbox(1));
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  document.addEventListener('keydown', event => {
    if (!lightbox.open) return;
    if (event.key === 'ArrowLeft') stepLightbox(-1);
    if (event.key === 'ArrowRight') stepLightbox(1);
  });

  // Keep three reviews in view on wide screens and provide a one-card carousel on phones.
  const reviewCards = [...document.querySelectorAll('.review-card')];
  const reviewDots = document.querySelector('.review-dots');
  let reviewIndex = 0;
  reviewCards.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'review-dot';
    dot.setAttribute('aria-label', `Show review ${index + 1}`);
    dot.addEventListener('click', () => { reviewIndex = index; updateReviews(); });
    reviewDots.append(dot);
  });
  function updateReviews() {
    reviewCards.forEach((card, index) => {
      card.classList.toggle('is-current', index === reviewIndex);
      card.classList.add('is-visible');
    });
    [...reviewDots.children].forEach((dot, index) => {
      dot.classList.toggle('is-current', index === reviewIndex);
      dot.setAttribute('aria-current', index === reviewIndex ? 'true' : 'false');
    });
  }
  document.querySelector('.review-prev').addEventListener('click', () => { reviewIndex = (reviewIndex - 1 + reviewCards.length) % reviewCards.length; updateReviews(); });
  document.querySelector('.review-next').addEventListener('click', () => { reviewIndex = (reviewIndex + 1) % reviewCards.length; updateReviews(); });
  updateReviews();

  // Booking form opens from every call to action. Keep service intent when supplied.
  document.querySelectorAll('.booking-trigger, [data-book-service]').forEach(button => button.addEventListener('click', () => {
    const service = button.dataset.bookService;
    closeMenu();
    bookingDialog.showModal();
    document.body.classList.add('dialog-open');
    if (service) bookingDialog.querySelector('[name="service"]').value = service;
  }));
  bookingDialog.querySelector('.dialog-close').addEventListener('click', () => bookingDialog.close());
  bookingDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  bookingDialog.addEventListener('click', event => { if (event.target === bookingDialog) bookingDialog.close(); });
  const dateInput = bookingDialog.querySelector('[name="date"]');
  const today = new Date();
  dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  bookingDialog.querySelector('#booking-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = [
      ['Name', `${data.get('firstName')} ${data.get('lastName')}`],
      ['Email', data.get('email')], ['Phone', data.get('phone')], ['Service', data.get('service')],
      ['Photoshoot date', data.get('date')], ['Location', data.get('location')], ['Budget', data.get('budget')], ['Dream photoshoot', data.get('message')]
    ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
    const subject = encodeURIComponent(`Photoshoot enquiry — ${data.get('service')}`);
    const body = encodeURIComponent(fields.join('\n\n'));
    window.location.href = `mailto:info@phenophoto.co.uk?subject=${subject}&body=${body}`;
    bookingDialog.close();
  });

  document.querySelector('#year').textContent = String(new Date().getFullYear());
})();
