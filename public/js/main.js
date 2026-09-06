// DOM selectors
const flashes = document.querySelectorAll('.flash');
const deleteForms = document.querySelectorAll('.deleteForm');
const heroFrame = document.querySelector('.hero-image-frame');
const canvas = document.querySelector('#hero-particles');
const profileFileInput = document.querySelector('#profile-file');
const profileFileName = document.querySelector('#profile-file-name');
const openListingModalBtn = document.querySelector('#open-create-listing-btn');
const listingModal = document.querySelector('#create-listing-modal');
const listingModalClose = document.querySelector('#create-listing-modal-close');
const videoRadios = document.querySelectorAll('input[name="has-video"]');
const videoUrlField = document.querySelector('#video-url-field');
const listingFileInput = document.querySelector('#modal-file-input');
const listingDropzone = document.querySelector('#dropzone');
const listingGalleryGrid = document.querySelector('#gallery-grid');
const listingGalleryCount = document.querySelector('#gallery-count');
const listingDropzonePrompt = document.querySelector('#dropzone-prompt');
const detailedMainImage = document.querySelector('#detailed-main-image');
const detailedThumbnails = document.querySelectorAll('.detailed-image-thumb');
const detailedStripThumbs = document.querySelectorAll('.detailed-strip-thumb');
const imageLightbox = document.querySelector('#image-lightbox');
const imageLightboxImg = document.querySelector('#image-lightbox-img');
const imageLightboxClose = document.querySelector('#image-lightbox-close');

// Shared state
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RISE_COLOR = '232, 233, 243'; // #E8E9F3
const TWINKLE_COLOR = '168, 85, 247'; // #A855F7
const MAX_LISTING_IMAGES = 10;
let selectedListingFiles = [];
let lastFocusedStripThumb = null;

// Helper functions
function dismissFlash(flash) {
  setTimeout(() => {
    flash.remove();
  }, 300);
}

function makeRiser(w, h) {
  return {
    type: 'rise',
    x: Math.random() * w,
    y: h + 10,
    speed: 12 + Math.random() * 16,
    drift: (Math.random() - 0.5) * 8,
    size: 1 + Math.random() * 1.6,
    opacity: 0.25 + Math.random() * 0.4,
  };
}

function makeTwinkle(w, h) {
  return {
    type: 'twinkle',
    x: Math.random() * w,
    y: Math.random() * h,
    size: 4 + Math.random() * 4,
    maxOpacity: 0.35 + Math.random() * 0.45,
    life: Math.random(),
    lifeSpeed: 0.12 + Math.random() * 0.18,
    spin: Math.random() * Math.PI,
  };
}

function drawSparkle(ctx, cx, cy, size, rotation) {
  const inner = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i + rotation;
    const r = i % 2 === 0 ? size : inner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function getModalFocusable() {
  return listingModal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
}

// Keeps the real <input type="file"> in sync with the JS-tracked selection,
// since drag-and-drop and multi-step selection don't update it on their own —
// without this, only whichever files were most recently dropped/picked would
// actually be included when the form submits.
function syncListingFileInput() {
  const dataTransfer = new DataTransfer();
  selectedListingFiles.forEach((file) => dataTransfer.items.add(file));
  listingFileInput.files = dataTransfer.files;
}

function renderListingGallery() {
  listingGalleryGrid.innerHTML = '';

  selectedListingFiles.forEach((file, index) => {
    const thumb = document.createElement('div');
    thumb.className = 'gallery-thumb';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = `Selected photo ${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'gallery-thumb-remove';
    removeBtn.setAttribute('aria-label', `Remove photo ${index + 1}`);
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => {
      selectedListingFiles.splice(index, 1);
      renderListingGallery();
    });

    thumb.appendChild(img);
    thumb.appendChild(removeBtn);
    listingGalleryGrid.appendChild(thumb);
  });

  listingGalleryCount.textContent = `${selectedListingFiles.length} / ${MAX_LISTING_IMAGES} photos`;
  listingGalleryCount.classList.toggle('gallery-count--full', selectedListingFiles.length >= MAX_LISTING_IMAGES);
  listingDropzonePrompt.style.display = selectedListingFiles.length >= MAX_LISTING_IMAGES ? 'none' : '';
  listingFileInput.disabled = selectedListingFiles.length >= MAX_LISTING_IMAGES;

  syncListingFileInput();
}

function wireCharCounter(inputId, counterId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;
  input.addEventListener('input', () => {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.classList.toggle('char-counter--near-limit', len >= max * 0.9);
  });
}

// Handler functions
function handleProfileFileChange(event) {
  const fileName = event.target.files[0]?.name;
  profileFileName.textContent = fileName || 'No file chosen';
}

function openListingModal() {
  listingModal.hidden = false;
  const focusable = getModalFocusable();
  if (focusable.length) focusable[0].focus();
  document.addEventListener('keydown', handleModalKeydown);
}

function closeListingModal() {
  listingModal.hidden = true;
  document.removeEventListener('keydown', handleModalKeydown);
  openListingModalBtn.focus();
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') {
    closeListingModal();
    return;
  }
  if (event.key === 'Tab') {
    const focusable = Array.from(getModalFocusable());
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function handleVideoToggleChange() {
  videoUrlField.classList.toggle('is-visible', document.getElementById('video-yes').checked);
}

function addListingFiles(fileList) {
  const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  const room = MAX_LISTING_IMAGES - selectedListingFiles.length;
  selectedListingFiles = selectedListingFiles.concat(incoming.slice(0, room));
  renderListingGallery();
}

function handleThumbnailClick(event) {
  const thumb = event.currentTarget;
  detailedMainImage.src = thumb.dataset.imageUrl;
  detailedThumbnails.forEach((t) => t.removeAttribute('aria-current'));
  thumb.setAttribute('aria-current', 'true');
}

function openImageLightbox(event) {
  lastFocusedStripThumb = event.currentTarget;
  imageLightboxImg.src = event.currentTarget.dataset.imageUrl;
  imageLightbox.hidden = false;
  imageLightboxClose.focus();
  document.addEventListener('keydown', handleLightboxKeydown);
}

function closeImageLightbox() {
  imageLightbox.hidden = true;
  imageLightboxImg.src = '';
  document.removeEventListener('keydown', handleLightboxKeydown);
  if (lastFocusedStripThumb) lastFocusedStripThumb.focus();
}

function handleLightboxKeydown(event) {
  if (event.key === 'Escape') closeImageLightbox();
}

function handleFlashDismiss(flash) {
  const isError = flash.classList.contains('flash-error');
  const timeout = isError ? 7000 : 5000;

  const dismissTimer = setTimeout(() => {
    dismissFlash(flash);
  }, timeout);

  // Manual dismiss
  const closeBtn = flash.querySelector('.flash-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(dismissTimer);
      dismissFlash(flash);
    });
  }
}

function handleFrameResize(entries) {
  for (const entry of entries) {
    heroFrame.style.setProperty('--frame-size', `${entry.contentRect.width}px`);
  }
}

function initHeroParticles() {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const heroSection = canvas.closest('.hero');

  let w, h;
  let particles = [];

  function resizeCanvas() {
    const rect = heroSection.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedParticles() {
    const riseCount = reduceMotion ? 0 : 35;
    const twinkleCount = 25;

    particles = [];
    for (let i = 0; i < riseCount; i++) {
      const p = makeRiser(w, h);
      p.y = Math.random() * h; // stagger initial heights so they don't all start at the bottom
      particles.push(p);
    }
    for (let i = 0; i < twinkleCount; i++) particles.push(makeTwinkle(w, h));
  }

  resizeCanvas();
  seedParticles();

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // clamp for tab-switch pauses
    lastTime = now;

    ctx.clearRect(0, 0, w, h);

    particles.forEach((p, i) => {
      if (p.type === 'rise') {
        p.y -= p.speed * dt;
        p.x += p.drift * dt;
        if (p.y < -10) particles[i] = makeRiser(w, h);
        ctx.fillStyle = `rgba(${RISE_COLOR}, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        let alpha = p.maxOpacity * 0.7;
        if (!reduceMotion) {
          p.life += p.lifeSpeed * dt;
          if (p.life > 1) particles[i] = makeTwinkle(w, h);
          alpha = p.maxOpacity * Math.sin(Math.min(p.life, 1) * Math.PI);
        }
        ctx.fillStyle = `rgba(${TWINKLE_COLOR}, ${alpha.toFixed(2)})`;
        drawSparkle(ctx, p.x, p.y, p.size, p.spin);
      }
    });

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    seedParticles();
  });

  requestAnimationFrame(tick);
}

// Confirmation before delete - profileController.deleteProfile & auctionController.deleteAuction
function handleDeleteConfirm(event) {
  const confirmed = confirm('Are you sure you want to permanently DELETE this?\n' + 'This action cannot be UNDONE.');

  if (!confirmed) {
    event.preventDefault();
  }
}

// Event listeners
if (profileFileInput && profileFileName) {
  profileFileInput.addEventListener('change', handleProfileFileChange);
}

if (openListingModalBtn && listingModal && listingModalClose) {
  openListingModalBtn.addEventListener('click', openListingModal);
  listingModalClose.addEventListener('click', closeListingModal);
  listingModal.addEventListener('click', (event) => {
    if (event.target === listingModal) closeListingModal();
  });
}

if (videoRadios.length && videoUrlField) {
  videoRadios.forEach((radio) => radio.addEventListener('change', handleVideoToggleChange));
}

if (listingDropzone && listingFileInput && listingGalleryGrid && listingGalleryCount && listingDropzonePrompt) {
  wireCharCounter('modal-title-input', 'title-counter', 100);
  wireCharCounter('modal-desc-input', 'desc-counter', 2000);

  listingFileInput.addEventListener('change', () => {
    addListingFiles(listingFileInput.files);
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    listingDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      listingDropzone.classList.add('dropzone--active');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    listingDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      listingDropzone.classList.remove('dropzone--active');
    });
  });
  listingDropzone.addEventListener('drop', (e) => {
    addListingFiles(e.dataTransfer.files);
  });
}

if (detailedMainImage && detailedThumbnails.length) {
  detailedThumbnails.forEach((thumb) => thumb.addEventListener('click', handleThumbnailClick));
}

if (detailedStripThumbs.length && imageLightbox && imageLightboxClose) {
  detailedStripThumbs.forEach((thumb) => thumb.addEventListener('click', openImageLightbox));
  imageLightboxClose.addEventListener('click', closeImageLightbox);
  imageLightbox.addEventListener('click', (event) => {
    if (event.target === imageLightbox) closeImageLightbox();
  });
}

flashes.forEach(handleFlashDismiss);

deleteForms.forEach((deleteForm) => {
  deleteForm.addEventListener('submit', handleDeleteConfirm);
});

if (heroFrame && 'ResizeObserver' in window) {
  new ResizeObserver(handleFrameResize).observe(heroFrame);
}

if (canvas) {
  initHeroParticles();
}