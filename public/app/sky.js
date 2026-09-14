/* nvate — живое золотое небо студии.
   Один canvas на всю сцену: россыпь звёзд разной глубины, редкие падающие
   звёзды и мягкая золотая пыль. Небо подхватывает цвет активного блока
   (--scene-r/g/b) и перекрашивается так же плавно, как фон.

   Правила: ничего не рисуем во вкладке в фоне и под сплошной шторкой, уважаем
   prefers-reduced-motion, на узких экранах держим 40 кадров — телефон не должен
   греться. */
'use strict';

window.Sky = (function () {
  const canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) return { setTone() {}, flare() {}, rest() {} };

  const ctx = canvas.getContext('2d', { alpha: true });
  const slowMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* data-motion="full" на <html> включает движение принудительно — нужно для
     ручной проверки в средах, где браузер всегда репортит reduced-motion. */
  const still = () => slowMotion.matches && document.documentElement.dataset.motion !== 'full';

  /* Общий темп неба. Четверть «естественной» скорости: за текстом небо должно
     едва дышать — любое заметное движение в фоне читается как рябь и мешает
     читать. Один множитель ведёт всё: мерцание, дрейф, пыль и падающие звёзды. */
  const SPEED = .25;

  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let dust = [];
  let shots = [];
  let nextShot = 4200;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let scroll = 0;
  /* Сцену закрыла сплошная шторка — небо стоит на своём кадре. Разметка
     приходит уже с классом stage-rest: первым всегда открывается экран языка. */
  let resting = document.documentElement.classList.contains('stage-rest');

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

  /* Мягкое пятно света рисуется один раз в отдельный canvas и дальше только
     копируется. Раньше на каждую звезду и пылинку в каждом кадре собирался
     новый радиальный градиент — под сотню градиентов за кадр, и телефон грелся
     на ровном месте. Спрайт пересобирается лишь когда тон неба заметно уехал. */
  const glow = document.createElement('canvas');
  const glowCtx = glow.getContext('2d');
  const GLOW_R = 48;
  let glowTone = null;

  function buildGlow() {
    glow.width = glow.height = GLOW_R * 2;
    const g = glowCtx.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
    const r = Math.round(tone.r * .35 + 255 * .65);
    const g2 = Math.round(tone.g * .4 + 250 * .6);
    const b = Math.round(tone.b * .5 + 226 * .5);
    g.addColorStop(0, `rgba(${r},${g2},${b},1)`);
    g.addColorStop(.5, `rgba(${r},${g2},${b},.26)`);
    g.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    glowCtx.clearRect(0, 0, glow.width, glow.height);
    glowCtx.fillStyle = g;
    glowCtx.fillRect(0, 0, glow.width, glow.height);
    glowTone = { r: tone.r, g: tone.g, b: tone.b };
  }

  /* Спрайт догоняет тон неба не каждый кадр, а когда цвет реально сменился. */
  function syncGlow() {
    if (!glowTone
      || Math.abs(glowTone.r - tone.r) > 6
      || Math.abs(glowTone.g - tone.g) > 6
      || Math.abs(glowTone.b - tone.b) > 6) buildGlow();
  }

  function paintGlow(x, y, radius, alpha) {
    if (alpha <= .01) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(glow, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  /* Плотность подбирается по площади: на телефоне звёзд меньше, чем на планшете.
     Небо держим разреженным — звёзды здесь фон за текстом, а не главный герой. */
  function build() {
    const area = W * H;
    const count = Math.round(Math.min(120, Math.max(44, area / 13000)));
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

    const dustCount = Math.round(Math.min(14, Math.max(5, area / 90000)));
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
    const y = ((s.y * H - scroll * s.depth * .06 * SPEED - clock * .0016 * s.drift * H) % (H + 40) + H + 40) % (H + 40) - 20;
    const x = s.x * W;
    const r = s.r;
    const warm = s.warm;
    const cr = warm ? Math.round(tone.r * .35 + 255 * .65) : 245;
    const cg = warm ? Math.round(tone.g * .4 + 250 * .6) : 248;
    const cb = warm ? Math.round(tone.b * .5 + 226 * .5) : 255;

    if (s.depth > .7) paintGlow(x, y, r * 6.5, alpha * .5);

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
    d.x += d.vx * dt * SPEED / 1000;
    d.y += d.vy * dt * SPEED / 1000;
    if (d.y < -.1) { d.y = 1.1; d.x = Math.random(); }
    if (d.x < -.1) d.x = 1.1;
    if (d.x > 1.1) d.x = -.1;
    const x = d.x * W;
    const y = d.y * H;
    const breathe = .72 + .28 * Math.sin(clock * .0006 + d.phase);
    paintGlow(x, y, d.r, d.a * breathe);
  }

  function drawShot(s, dt) {
    // Жизнь и путь идут одним темпом: трасса та же, только вдвое спокойнее.
    s.life += dt * SPEED;
    s.x += s.vx * dt * SPEED;
    s.y += s.vy * dt * SPEED;
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

    paintGlow(s.x, s.y, 7, alpha);
    return s.x > -200 && s.x < W + 200 && s.y < H + 200;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - last || 16);
    /* Небо движется очень медленно, поэтому частые кадры ему не нужны:
       30 fps на телефоне и 50 на большом экране глаз не отличает, а работы
       вдвое меньше. */
    const step = W < 560 ? 33 : 20;
    if (now - last < step) return;
    last = now;
    draw(dt);
  }

  function draw(dt) {
    clock += dt * SPEED;

    // Догоняем целевой тон — 1.5 % за кадр даёт мягкий переход около двух секунд.
    tone.r += (target.r - tone.r) * .015;
    tone.g += (target.g - tone.g) * .015;
    tone.b += (target.b - tone.b) * .015;
    syncGlow();

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
    syncGlow();
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of stars) drawStar(s, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function play() {
    if (raf) return;
    if (still()) { paintStill(); return; }
    // Под шторкой — один настоящий кадр без бега: время неба не идёт.
    if (resting) { draw(0); return; }
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
    resizeTimer = setTimeout(() => {
      resize();
      if (still()) paintStill();
      else if (resting) draw(0);
    }, 180);
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
    /* Шторка закрыла сцену — небо замирает на своём кадре; шторка уходит —
       небо идёт дальше с того же места. */
    rest(on) {
      resting = Boolean(on);
      if (resting) stop(); else play();
    },
  };
})();
