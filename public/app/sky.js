/* nvate — живое золотое небо студии.
   Один canvas на всю сцену: россыпь звёзд разной глубины, редкие падающие
   звёзды и мягкая золотая пыль. Небо подхватывает цвет активного блока
   (--scene-r/g/b) и перекрашивается так же плавно, как фон.

   Правила: ничего не рисуем во вкладке в фоне, уважаем prefers-reduced-motion,
   на узких экранах держим 40 кадров — телефон не должен греться. */
'use strict';

window.Sky = (function () {
  const canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return { setTone() {}, flare() {} };

  const ctx = canvas.getContext('2d', { alpha: true });
  const slowMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* data-motion="full" на <html> включает движение принудительно — нужно для
     ручной проверки в средах, где браузер всегда репортит reduced-motion. */
  const still = () => slowMotion.matches && document.documentElement.dataset.motion !== 'full';

  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let dust = [];
  let shots = [];
  let nextShot = 4200;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let scroll = 0;

  /* Тон неба: к чему стремимся (цель) и что рисуем сейчас — между ними
     всегда идёт плавная догонялка, поэтому смена блока не «щёлкает». */
  const tone = { r: 215, g: 168, b: 63 };
  const target = { r: 215, g: 168, b: 63 };

  const rnd = (min, max) => min + Math.random() * (max - min);

  function readTone() {
    const css = getComputedStyle(document.documentElement);
    const r = Number(css.getPropertyValue('--scene-r'));
    const g = Number(css.getPropertyValue('--scene-g'));
    const b = Number(css.getPropertyValue('--scene-b'));
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      target.r = r; target.g = g; target.b = b;
      tone.r = r; tone.g = g; tone.b = b;
    }
  }

  /* Плотность подбирается по площади: на телефоне звёзд меньше, чем на планшете. */
  function build() {
    const area = W * H;
    const count = Math.round(Math.min(190, Math.max(70, area / 7600)));
    stars = Array.from({ length: count }, () => {
      const depth = Math.random();               // 0 — далеко, 1 — близко
      return {
        x: Math.random(),
        y: Math.random(),
        depth,
        r: depth > .93 ? rnd(1.5, 2.3) : depth > .7 ? rnd(.9, 1.5) : rnd(.35, .85),
        base: depth > .7 ? rnd(.5, .95) : rnd(.16, .5),
        speed: rnd(.35, 1.15),                    // темп мерцания
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() < .74,                // тёплая (золотая) или холодная (белая)
        spikes: depth > .93,                      // крупным рисуем лучи
        drift: rnd(.15, .6),
      };
    });

    const dustCount = Math.round(Math.min(26, Math.max(8, area / 46000)));
    dust = Array.from({ length: dustCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rnd(9, 26),
      a: rnd(.03, .085),
      vx: rnd(-.006, .006),
      vy: rnd(-.011, -.003),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function spawnShot() {
    // Падают всегда сверху-сбоку внутрь кадра — так читается как «звезда», а не как царапина.
    const fromLeft = Math.random() < .5;
    const angle = fromLeft ? rnd(.32, .58) : Math.PI - rnd(.32, .58);
    shots.push({
      x: fromLeft ? rnd(-.05, .45) * W : rnd(.55, 1.05) * W,
      y: rnd(-.02, .34) * H,
      vx: Math.cos(angle) * rnd(.42, .72) * W / 1000,
      vy: Math.sin(angle) * rnd(.42, .72) * W / 1000,
      life: 0,
      span: rnd(1100, 1750),
      len: rnd(90, 190),
    });
  }

  function drawStar(s, t) {
    const twinkle = .55 + .45 * Math.sin(t * .0012 * s.speed + s.phase);
    const alpha = Math.min(1, s.base * twinkle);
    if (alpha <= .01) return;
    // Параллакс: близкие звёзды заметнее реагируют на скролл страницы.
    const y = ((s.y * H - scroll * s.depth * .06 - clock * .0016 * s.drift * H) % (H + 40) + H + 40) % (H + 40) - 20;
    const x = s.x * W;
    const r = s.r;
    const warm = s.warm;
    const cr = warm ? Math.round(tone.r * .35 + 255 * .65) : 245;
    const cg = warm ? Math.round(tone.g * .4 + 250 * .6) : 248;
    const cb = warm ? Math.round(tone.b * .5 + 226 * .5) : 255;

    if (s.depth > .7) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6.5);
      glow.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * .5})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (s.spikes) {
      // Четыре тонких луча — тот самый «дорогой» блеск на крупных звёздах.
      const len = r * (4.5 + twinkle * 3.4);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * .34})`;
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
      ctx.stroke();
    }
  }

  function drawDust(d, dt) {
    d.x += d.vx * dt / 1000;
    d.y += d.vy * dt / 1000;
    if (d.y < -.1) { d.y = 1.1; d.x = Math.random(); }
    if (d.x < -.1) d.x = 1.1;
    if (d.x > 1.1) d.x = -.1;
    const x = d.x * W;
    const y = d.y * H;
    const breathe = .72 + .28 * Math.sin(clock * .0006 + d.phase);
    const g = ctx.createRadialGradient(x, y, 0, x, y, d.r);
    g.addColorStop(0, `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${d.a * breathe})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShot(s, dt) {
    s.life += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const k = s.life / s.span;
    if (k >= 1) return false;
    // Появляется и гаснет мягко: резкие вспышки выглядят дёшево.
    const alpha = Math.sin(Math.PI * k) * .85;
    const nx = s.vx, ny = s.vy;
    const mag = Math.hypot(nx, ny) || 1;
    const tailX = s.x - (nx / mag) * s.len;
    const tailY = s.y - (ny / mag) * s.len;
    const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    grad.addColorStop(0, `rgba(255,246,220,${alpha})`);
    grad.addColorStop(.35, `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${alpha * .5})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    const head = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 7);
    head.addColorStop(0, `rgba(255,250,232,${alpha})`);
    head.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill();
    return s.x > -200 && s.x < W + 200 && s.y < H + 200;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - last || 16);
    // На телефоне держим ~40 fps: глазу хватает, батарее легче.
    const step = W < 560 ? 25 : 16;
    if (now - last < step) return;
    last = now;
    clock += dt;

    // Догоняем целевой тон — 1.5 % за кадр даёт мягкий переход около двух секунд.
    tone.r += (target.r - tone.r) * .015;
    tone.g += (target.g - tone.g) * .015;
    tone.b += (target.b - tone.b) * .015;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) drawDust(d, dt);
    for (const s of stars) drawStar(s, clock);

    nextShot -= dt;
    if (nextShot <= 0) {
      spawnShot();
      nextShot = rnd(7000, 16000);
    }
    shots = shots.filter((s) => drawShot(s, dt));
    ctx.globalCompositeOperation = 'source-over';
  }

  /* Статичный кадр для reduced-motion: небо есть, движения нет. */
  function paintStill() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) drawStar(s, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function play() {
    if (raf) return;
    if (still()) { paintStill(); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (still()) paintStill(); }, 180);
  }, { passive: true });

  window.addEventListener('scroll', () => { scroll = window.scrollY; }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else play();
  });

  slowMotion.addEventListener?.('change', () => { stop(); play(); });

  resize();
  readTone();
  play();

  return {
    /* Цвет активной сцены: небо перекрашивается вслед за блоком. */
    setTone(r, g, b) {
      if (![r, g, b].every(Number.isFinite)) return;
      target.r = r; target.g = g; target.b = b;
      if (still()) { tone.r = r; tone.g = g; tone.b = b; paintStill(); }
    },
    /* Праздничный залп: несколько падающих звёзд подряд (заявка отправлена). */
    flare(count = 3) {
      if (still()) return;
      for (let i = 0; i < count; i += 1) setTimeout(spawnShot, i * 260);
    },
  };
})();
