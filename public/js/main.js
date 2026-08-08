// DOM selectors
const flashes = document.querySelectorAll('.flash');
const deleteForms = document.querySelectorAll('.deleteForm');
const heroFrame = document.querySelector('.hero-image-frame');
const canvas = document.getElementById('hero-particles');

// Shared state
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RISE_COLOR = '232, 233, 243'; // #E8E9F3
const TWINKLE_COLOR = '168, 85, 247'; // #A855F7

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

// Handler functions
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