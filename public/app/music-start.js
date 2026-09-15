/* global NvMusicPlayer */
/* nvate studio — выбор начала песни: «катушка».

   Волна песни лежит лентой под неподвижной золотой иглой. Ленту тянут пальцем
   и бросают — она докатывается сама; короткое касание подвозит к игле тот
   момент, куда нажали. Всё, что правее иглы, светится золотом: это и услышат
   гости. Под лентой — вся песня целиком с окошком видимого куска: по ней
   прыгают через всю песню одним движением.

   Пока звук ролика YouTube скачивается, лента дышит; как только файл готов,
   волна вырастает из середины. Если скачать не вышло, шкала рисуется по
   графику «самые пересматриваемые места» ролика или ровной лентой времени —
   работает она при этом так же. */
(function () {
  'use strict';

  const PX_PER_SEC = 18;          // масштаб ленты: точек экрана на секунду песни
  const PITCH = 4;                // шаг столбиков волны
  const BAR = 2.4;                // ширина столбика
  const REEL_H = 150;             // высота катушки: волна, отражение и линейка
  const MID = 72;                 // горизонт, от которого растут столбики
  const AMP_UP = 54;
  const AMP_DOWN = 22;
  const RULER_Y = 120;
  const MAP_H = 30;
  const NUDGES = [-1, -0.1, 0.1, 1];
  const MONO = '500 10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';

  const reduced = () => Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const lift = (value, by) => Math.min(255, Math.round(value + by));

  function create(ctx) {
    const { store, Core, Player, h, w, icon, cover, haptic, toast } = ctx;
    const els = {};
    let peaks = null;             // { peaks: Float32Array, rate }
    let heat = null;              // { end, values } — график ролика, пока звука нет
    let hint = null;              // «Топ выбор», секунды
    let job = null;               // AbortController подготовки песни
    let upgrade = null;           // скачивание звука ролика: { cancel }
    let breathing = false;        // лента дышит, пока волны нет
    let revealAt = 0;             // когда пришла волна: столбики растут из середины
    let glide = null;             // плавный подъезд: { from, to, t0, ms }
    let fling = null;             // инерция после броска: { v (px/мс), last }
    let resumeAfter = false;      // песня играла до касания — продолжить после
    let dragging = false;
    let motion = 0;
    let lastSecond = -1;
    let lastTick = 0;
    let rgb = [215, 168, 63];

    const draft = () => store.get().draft;
    const own = () => ctx.getOwner() === 'start';
    const ready = () => Boolean(draft()?.ready);

    /* ── Разметка ── */

    els.cover = h('span', { class: 'mlib-cover reel-cover' });
    els.title = h('b');
    els.artist = h('span');
    els.note = h('em', { class: 'reel-note', hidden: true });
    els.label = h('span', { class: 'reel-label' });
    els.read = h('b', { class: 'reel-read' }, '00:00.0');
    els.sub = h('span', { class: 'reel-sub' });
    els.canvas = h('canvas', { class: 'reel-canvas', 'aria-hidden': 'true' });
    els.needle = h('span', { class: 'reel-needle', 'aria-hidden': 'true' }, h('i', {}), h('i', {}));
    els.reel = h('div', { class: 'reel is-loading', role: 'slider', tabindex: '0', 'aria-valuemin': '0' }, els.canvas, els.needle);
    els.mapCanvas = h('canvas', { class: 'reel-map-canvas', 'aria-hidden': 'true' });
    els.window = h('span', { class: 'reel-map-window', 'aria-hidden': 'true' });
    els.map = h('div', { class: 'reel-map' }, els.mapCanvas, els.window);
    els.zero = h('span', {}, '00:00');
    els.end = h('span', {}, '');
    els.nudges = NUDGES.map((delta) => {
      const text = `${delta > 0 ? '+' : '−'}${Math.abs(delta) >= 1 ? '1s' : '0.1'}`;
      const button = h('button', { type: 'button', class: 'reel-nudge' }, text);
      button.addEventListener('click', () => nudge(delta));
      return button;
    });
    els.play = h('button', { type: 'button', class: 'reel-play' },
      h('span', { class: 'reel-play-ring', 'aria-hidden': 'true' }), icon('play', true), icon('pause'));
    els.playTxt = h('span', { class: 'reel-play-txt' });
    els.top = h('button', { type: 'button', class: 'reel-top', hidden: true });
    els.back = h('button', { type: 'button', class: 'btn btn--ghost reel-back' });
    els.save = h('button', { type: 'button', class: 'btn btn--gold reel-save' });

    els.view = h('div', { class: 'mlib-view--start reel-view', hidden: true },
      h('div', { class: 'reel-track' },
        els.cover,
        h('div', { class: 'reel-info' }, els.title, els.artist, els.note)),
      h('div', { class: 'reel-stage' },
        h('div', { class: 'reel-readout' }, els.label, els.read, els.sub),
        els.reel,
        h('div', { class: 'reel-overview' }, els.map, h('div', { class: 'reel-scale' }, els.zero, els.end))),
      h('div', { class: 'reel-deck' },
        els.nudges[0], els.nudges[1],
        h('div', { class: 'reel-play-wrap' }, els.play, els.playTxt),
        els.nudges[2], els.nudges[3]),
      els.top,
      h('footer', { class: 'reel-foot' }, els.back, els.save));

    /* ── Подготовка песни ── */

    function abort() {
      if (job) job.abort();
      job = null;
      if (upgrade) upgrade.cancel();
      upgrade = null;
      stopMotion();
      hint = null;
      heat = null;
      peaks = null;
      revealAt = 0;
      setNote('');
    }

    async function prepare(track) {
      abort();
      const current = new AbortController();
      job = current;
      const { signal } = current;
      paintTrack(track);
      rgb = sceneRgb();
      breathing = true;
      loop();
      let duration = Number(track.duration) || 0;
      if (!duration && track.playback === 'audio') duration = await NvMusicPlayer.probeDuration(track.audioUrl, signal);
      if (!duration && track.playback === 'youtube') duration = await Player.youtubeDuration(track, signal);
      if (signal.aborted) return;
      if (!(duration > 0)) {
        toast(w('trackError'), 'err');
        store.dispatch({ type: 'back' });
        return;
      }
      store.dispatch({ type: 'draft:ready', key: Core.trackKey(track), duration });
      loadHint(track, signal);
      if (track.playback === 'audio') loadWave(track, signal);
      else if (ctx.upgrade) beginUpgrade(track, signal);
      else settle();
    }

    function loadWave(track, signal) {
      const key = Core.trackKey(track);
      breathing = true;
      loop();
      NvMusicPlayer.loadPeaks(track.audioUrl, signal).then((wave) => {
        if (signal.aborted || Core.trackKey(draft()?.track) !== key) return;
        peaks = wave;
        settle();
      }, () => {
        // Источник не пустил или декодер не справился — остаётся шкала времени.
        if (!signal.aborted) settle();
      });
    }

    /* Ролик YouTube: пока звук качается, выбирать начало уже можно — по плееру.
       Готов файл — черновик тихо переезжает на него, и волна вырастает. */
    function beginUpgrade(track, signal) {
      const key = Core.trackKey(track);
      setNote(w('waveCooking'));
      upgrade = ctx.upgrade(track, {
        progress(value) {
          if (signal.aborted) return;
          setNote(value > 0 && value < 1 ? `${w('waveCooking')} · ${Math.round(value * 100)}%` : w('waveCooking'));
        },
        done(next) {
          upgrade = null;
          if (signal.aborted || Core.trackKey(draft()?.track) !== key) return;
          const wasPlaying = own() && Player.isPlaying();
          if (own()) Player.stop();
          store.dispatch({ type: 'draft:swap', key, track: next });
          setNote('');
          paintTrack(next, true);
          loadWave(next, signal);
          if (wasPlaying) playFrom();
        },
        failed() {
          upgrade = null;
          if (signal.aborted) return;
          setNote('');
          settle();
        },
      });
    }

    async function loadHint(track, signal) {
      try {
        const query = new URLSearchParams({ provider: track.provider, id: track.id });
        const data = await ctx.api(`/api/music/hint?${query}`, { signal });
        const d = draft();
        if (signal.aborted || !d) return;
        if (data.heat && Array.isArray(data.heat.values) && data.heat.values.length >= 20) heat = data.heat;
        const at = Number(data.hint?.start);
        if (Number.isFinite(at) && at > 0 && at < d.track.duration - 1) hint = at;
        render();
      } catch (_) { /* подсказки нет — выбирают сами */ }
    }

    function settle() {
      breathing = false;
      revealAt = peaks && !reduced() ? performance.now() : 0;
      paint();
      loop();
    }

    function setNote(value) {
      els.note.textContent = value;
      els.note.hidden = !value;
    }

    /* ── Движение ── */

    function wantsFrames(now) {
      return breathing || dragging || Boolean(glide) || Boolean(fling)
        || (revealAt && now - revealAt < 1300) || (own() && Player.isPlaying());
    }

    function loop() {
      if (motion || els.view.hidden) return;
      const frame = (now) => {
        motion = 0;
        step(now);
        paint(now);
        if (!els.view.hidden && wantsFrames(now)) motion = requestAnimationFrame(frame);
      };
      motion = requestAnimationFrame(frame);
    }

    function stopMotion() {
      cancelAnimationFrame(motion);
      motion = 0;
      glide = null;
      fling = null;
      breathing = false;
      dragging = false;
    }

    function step(now) {
      const d = draft();
      if (!d || !d.ready) return;
      if (glide) {
        const p = clamp01((now - glide.t0) / glide.ms);
        const eased = 1 - Math.pow(1 - p, 3);
        setStart(glide.from + (glide.to - glide.from) * eased, true);
        if (p >= 1) {
          glide = null;
          finishMove();
        }
      } else if (fling) {
        const dt = Math.min(48, now - fling.last);
        fling.last = now;
        setStart(d.startAt - (fling.v * dt) / PX_PER_SEC, true);
        fling.v *= Math.pow(0.93, dt / 16);
        const at = draft().startAt;
        if (Math.abs(fling.v) < 0.03 || at <= 0 || at >= d.track.duration - 0.5) {
          fling = null;
          finishMove();
        }
      }
    }

    function setStart(at, quiet = false) {
      const d = draft();
      if (!d) return;
      store.dispatch({ type: 'start', startAt: at });
      // Щелчок на каждой пройденной секунде: ленту чувствуешь пальцем.
      const second = Math.floor(draft().startAt);
      const now = performance.now();
      if (quiet && second !== lastSecond && now - lastTick > 70) {
        haptic.tap();
        lastTick = now;
      }
      lastSecond = second;
    }

    function glideTo(at, ms = 460) {
      const d = draft();
      if (!d || !d.ready) return;
      fling = null;
      if (reduced()) {
        setStart(at);
        finishMove();
        return;
      }
      glide = { from: d.startAt, to: Core.clampStart(at, d.track.duration), t0: performance.now(), ms };
      loop();
    }

    function finishMove() {
      const d = draft();
      if (!d) return;
      setStart(Math.round(d.startAt * 10) / 10);
      if (resumeAfter) {
        resumeAfter = false;
        playFrom();
      }
    }

    /* ── Рисунок ── */

    function sceneRgb() {
      const style = getComputedStyle(document.documentElement);
      const value = ['--scene-r', '--scene-g', '--scene-b'].map((k) => Math.round(Number(style.getPropertyValue(k))));
      return value.every(Number.isFinite) && value.some(Boolean) ? value : [215, 168, 63];
    }

    function fit(canvas, cssWidth, cssHeight) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(cssWidth * dpr);
      const ph = Math.round(cssHeight * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
      }
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cssWidth, cssHeight);
      return g;
    }

    const roundBar = (g, x, y, bw, bh) => {
      if (g.roundRect) g.roundRect(x, y, bw, bh, Math.min(bw / 2, bh / 2));
      else g.rect(x, y, bw, bh);
    };

    /* Громкость столбика: волна файла, график ролика или дыхание ожидания. */
    function level(k, t, span, duration, x, cw, now) {
      const breath = 0.3 + 0.16 * Math.sin(k * 0.42 - now / 260) + 0.1 * Math.sin(k * 0.11 + now / 760);
      let real = null;
      if (peaks) {
        const from = Math.floor(t * peaks.rate);
        const to = Math.min(peaks.peaks.length, Math.max(from + 1, Math.floor((t + span) * peaks.rate)));
        let v = 0;
        for (let i = from; i < to; i += 1) if (peaks.peaks[i] > v) v = peaks.peaks[i];
        real = Math.max(0.05, v);
      } else if (heat && duration) {
        const values = heat.values;
        const pos = clamp01(t / (heat.end || duration)) * (values.length - 1);
        const i = Math.floor(pos);
        const a = values[i] ?? 0;
        const b = values[Math.min(values.length - 1, i + 1)] ?? a;
        // У графика ролика нет фактуры звука — лёгкая рябь, чтобы он читался волной.
        real = 0.1 + (a + (b - a) * (pos - i)) * 0.6 + 0.05 * Math.sin(k * 1.9);
      }
      if (real === null) return breathing && !reduced() ? breath : (k % 3 === 0 ? 0.14 : 0.09);
      if (revealAt) {
        const delay = (x / Math.max(1, cw)) * 420;
        const p = clamp01((now - revealAt - delay) / 560);
        const eased = 1 - Math.pow(1 - p, 3);
        return breath + (real - breath) * eased;
      }
      return real;
    }

    function paint(now = performance.now()) {
      paintReel(now);
      paintMap();
    }

    function paintReel(now) {
      const cw = Math.max(1, Math.round(els.reel.clientWidth));
      const g = fit(els.canvas, cw, REEL_H);
      const d = draft();
      if (!d) return;
      const duration = d.ready ? d.track.duration : 0;
      const start = d.ready ? d.startAt : 0;
      const center = cw / 2;
      const span = PITCH / PX_PER_SEC;
      const playAt = own() && d.ready && Player.isPlaying() ? Player.time() : null;
      const [r, gg, b] = rgb;
      const top = MID - AMP_UP;
      const midStop = AMP_UP / (AMP_UP + AMP_DOWN);

      const gold = g.createLinearGradient(0, top, 0, MID + AMP_DOWN);
      gold.addColorStop(0, `rgb(${lift(r, 46)}, ${lift(gg, 50)}, ${lift(b, 78)})`);
      gold.addColorStop(midStop * 0.92, '#fff3d6');
      gold.addColorStop(midStop, `rgba(${r}, ${gg}, ${b}, .62)`);
      gold.addColorStop(1, `rgba(${r}, ${gg}, ${b}, .04)`);
      const dim = g.createLinearGradient(0, top, 0, MID + AMP_DOWN);
      dim.addColorStop(0, 'rgba(247, 241, 231, .3)');
      dim.addColorStop(midStop, 'rgba(247, 241, 231, .2)');
      dim.addColorStop(1, 'rgba(247, 241, 231, .02)');

      // До иглы — то, чего гости не услышат: чуть притушено.
      const shade = g.createLinearGradient(0, 0, center, 0);
      shade.addColorStop(0, 'rgba(5, 4, 2, .34)');
      shade.addColorStop(1, 'rgba(5, 4, 2, .1)');
      g.fillStyle = shade;
      g.fillRect(0, 0, center, RULER_Y - 8);
      g.fillStyle = 'rgba(247, 241, 231, .07)';
      g.fillRect(0, MID, cw, 1);

      const layers = [[], [], []];                  // тусклые · золотые · уже сыгранные
      const kFrom = Math.max(0, Math.floor((start - center / PX_PER_SEC) / span) - 1);
      const kTo = Math.ceil((start + center / PX_PER_SEC) / span) + 1;
      const kLast = d.ready ? Math.floor(duration / span) : kTo;
      for (let k = kFrom; k <= Math.min(kTo, kLast); k += 1) {
        const t = k * span;
        const x = center + (t - start) * PX_PER_SEC - BAR / 2;
        if (x < -PITCH || x > cw + PITCH) continue;
        let v = level(k, t, span, duration, x, cw, now);
        if (playAt !== null) {
          const gap = Math.abs(t - playAt);
          if (gap < 1.4) v *= 1 + 0.24 * (1 - gap / 1.4);
        }
        const layer = !d.ready || t + span <= start ? 0 : playAt !== null && t < playAt ? 2 : 1;
        layers[layer].push([x, Math.max(2, Math.min(AMP_UP, v * AMP_UP)), Math.max(1, Math.min(AMP_DOWN, v * AMP_DOWN))]);
      }
      layers.forEach((bars, layer) => {
        if (!bars.length) return;
        g.beginPath();
        for (const [x, up, down] of bars) {
          roundBar(g, x, MID - up, BAR, up);
          roundBar(g, x, MID + 2, BAR, down);
        }
        if (layer === 2) {
          g.save();
          g.shadowColor = `rgba(${r}, ${gg}, ${b}, .9)`;
          g.shadowBlur = 9;
          g.fillStyle = '#fff8ea';
          g.fill();
          g.restore();
        } else {
          g.fillStyle = layer === 1 ? gold : dim;
          g.fill();
        }
      });

      if (!d.ready) return;

      // Линейка: секунды мелко, каждые пять — крупнее, подписи — каждые десять.
      g.font = MONO;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const sFrom = Math.max(0, Math.floor(start - center / PX_PER_SEC));
      const sTo = Math.min(Math.floor(duration), Math.ceil(start + center / PX_PER_SEC));
      for (let sec = sFrom; sec <= sTo; sec += 1) {
        const x = Math.round(center + (sec - start) * PX_PER_SEC) + 0.5;
        const major = sec % 5 === 0;
        g.fillStyle = major ? 'rgba(247, 241, 231, .4)' : 'rgba(247, 241, 231, .16)';
        g.fillRect(x - 0.5, RULER_Y, 1, major ? 8 : 4);
        if (sec % 10 === 0) {
          g.fillStyle = 'rgba(247, 241, 231, .5)';
          g.fillText(Core.clock(sec), x, RULER_Y + 12);
        }
      }

      if (hint !== null) {
        const x = center + (hint - start) * PX_PER_SEC;
        if (x > -10 && x < cw + 10) {
          g.fillStyle = `rgba(${lift(r, 36)}, ${lift(gg, 36)}, ${lift(b, 60)}, .4)`;
          for (let y = 16; y < MID - 4; y += 6) g.fillRect(x - 0.5, y, 1, 3);
          g.fillStyle = `rgb(${lift(r, 40)}, ${lift(gg, 40)}, ${lift(b, 64)})`;
          g.beginPath();
          g.moveTo(x, 3);
          g.lineTo(x + 5, 8);
          g.lineTo(x, 13);
          g.lineTo(x - 5, 8);
          g.closePath();
          g.fill();
        }
      }

      if (playAt !== null) {
        const x = Math.min(cw - 3, Math.max(center, center + (playAt - start) * PX_PER_SEC));
        g.save();
        g.shadowColor = `rgba(${r}, ${gg}, ${b}, 1)`;
        g.shadowBlur = 12;
        g.fillStyle = '#fffaf0';
        g.fillRect(x - 1, 10, 2, MID + AMP_DOWN - 10);
        g.beginPath();
        g.arc(x, 10, 3.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }

    function paintMap() {
      const mw = Math.max(1, Math.round(els.map.clientWidth));
      const g = fit(els.mapCanvas, mw, MAP_H);
      const d = draft();
      if (!d || !d.ready) {
        els.window.style.opacity = '0';
        return;
      }
      const duration = d.track.duration;
      const count = Math.max(12, Math.floor(mw / 3));
      const split = (d.startAt / duration) * mw;
      const [r, gg, b] = rgb;
      const lit = [];
      const dimBars = [];
      for (let i = 0; i < count; i += 1) {
        const t0 = (i / count) * duration;
        const t1 = ((i + 1) / count) * duration;
        let v = 0.32;
        if (peaks) {
          v = 0;
          const from = Math.floor(t0 * peaks.rate);
          const to = Math.min(peaks.peaks.length, Math.max(from + 1, Math.floor(t1 * peaks.rate)));
          for (let k = from; k < to; k += 3) if (peaks.peaks[k] > v) v = peaks.peaks[k];
        } else if (heat) {
          const pos = clamp01(t0 / (heat.end || duration)) * (heat.values.length - 1);
          v = 0.15 + (heat.values[Math.round(pos)] ?? 0) * 0.75;
        }
        const x = (i / count) * mw;
        const bh = Math.max(2, v * (MAP_H - 6));
        (x + 2 > split ? lit : dimBars).push([x, (MAP_H - bh) / 2, bh]);
      }
      for (const [bars, style] of [[dimBars, 'rgba(247, 241, 231, .2)'], [lit, `rgba(${lift(r, 30)}, ${lift(gg, 34)}, ${lift(b, 50)}, .85)`]]) {
        if (!bars.length) continue;
        g.beginPath();
        for (const [x, y, bh] of bars) roundBar(g, x, y, 2, bh);
        g.fillStyle = style;
        g.fill();
      }
      const seen = els.reel.clientWidth / PX_PER_SEC;
      const left = clamp01((d.startAt - seen / 2) / duration);
      const right = clamp01((d.startAt + seen / 2) / duration);
      els.window.style.opacity = '1';
      els.window.style.left = `${left * 100}%`;
      els.window.style.width = `${Math.max(2, (right - left) * 100)}%`;
    }

    function paintTrack(track, keepExtras = false) {
      els.cover.replaceChildren(...cover(track));
      els.title.textContent = track.title;
      els.artist.textContent = track.artist || '';
      if (!keepExtras) {
        peaks = null;
        hint = null;
        heat = null;
      }
    }

    function paintPlay(playing = own() && Player.isPlaying()) {
      els.view.classList.toggle('is-playing', playing);
      els.playTxt.textContent = playing ? w('pause') : w('playFrom');
      els.play.setAttribute('aria-label', playing ? w('pause') : w('playFrom'));
      if (playing) loop();
      else paint();
    }

    function render() {
      const s = store.get();
      const d = s.draft;
      els.label.textContent = w('startLabel');
      els.sub.textContent = w('startHint');
      els.back.textContent = w('back');
      els.save.textContent = s.saving ? w('saving') : w('save');
      els.reel.setAttribute('aria-label', w('startSlider'));
      els.nudges.forEach((button, i) => button.setAttribute('aria-label', w('nudge', NUDGES[i])));
      if (!d) return;
      els.reel.classList.toggle('is-loading', !d.ready);
      els.read.textContent = Core.clock(d.startAt, true);
      els.end.textContent = d.ready ? Core.clock(d.track.duration) : '';
      els.save.disabled = !d.ready || s.saving;
      els.play.disabled = !d.ready;
      els.nudges.forEach((button) => { button.disabled = !d.ready; });
      els.reel.setAttribute('aria-valuenow', String(d.startAt));
      els.reel.setAttribute('aria-valuetext', Core.clock(d.startAt, true));
      if (d.ready) els.reel.setAttribute('aria-valuemax', String(d.track.duration));
      els.top.hidden = hint === null || Math.abs(hint - d.startAt) < 0.5;
      if (!els.top.hidden) els.top.replaceChildren(h('span', { class: 'reel-top-star', 'aria-hidden': 'true' }), h('span', {}, w('top')), h('b', {}, Core.clock(hint)));
      els.playTxt.textContent = els.view.classList.contains('is-playing') ? w('pause') : w('playFrom');
      if (!motion) paint();
    }

    /* ── Действия ── */

    function nudge(delta) {
      const d = draft();
      if (!d || !d.ready) return;
      haptic.tap();
      glide = null;
      fling = null;
      setStart(Math.round((d.startAt + delta) * 100) / 100);
      if (own() && Player.isPlaying()) playFrom();
    }

    function playFrom() {
      const d = draft();
      if (!d || !d.ready) return;
      ctx.setOwner('start');
      const current = Player.current();
      if (current && Core.trackKey(current) === Core.trackKey(d.track)) {
        Player.seek(d.startAt);
        Player.play();
      } else {
        Player.load(d.track, { at: d.startAt, autoplay: true });
      }
      loop();
    }

    function togglePlay() {
      if (!ready()) return;
      haptic.tap();
      if (own() && Player.isPlaying()) Player.pause();
      else playFrom();
    }

    const samples = [];
    els.reel.addEventListener('pointerdown', (event) => {
      if (!ready() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      try { els.reel.setPointerCapture(event.pointerId); } catch (_) { /* старый браузер */ }
      glide = null;
      fling = null;
      const resume = own() && Player.isPlaying();
      if (resume) Player.pause();
      dragging = true;
      els.reel.classList.add('is-dragging');
      const t0 = performance.now();
      let lastX = event.clientX;
      let moved = 0;
      samples.length = 0;
      samples.push([t0, event.clientX]);
      loop();

      const move = (e) => {
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        moved += Math.abs(dx);
        samples.push([performance.now(), e.clientX]);
        while (samples.length > 6) samples.shift();
        setStart(draft().startAt - dx / PX_PER_SEC, true);
      };
      const up = (e) => {
        els.reel.removeEventListener('pointermove', move);
        els.reel.removeEventListener('pointerup', up);
        els.reel.removeEventListener('pointercancel', up);
        dragging = false;
        els.reel.classList.remove('is-dragging');
        resumeAfter = resume;
        const now = performance.now();
        if (e.type === 'pointerup' && moved < 6 && now - t0 < 320) {
          // Касание: этот момент подъезжает к игле.
          const rect = els.reel.getBoundingClientRect();
          haptic.tap();
          glideTo(draft().startAt + (e.clientX - rect.left - rect.width / 2) / PX_PER_SEC);
          return;
        }
        const recent = samples.filter(([ts]) => now - ts < 120);
        if (e.type === 'pointerup' && recent.length >= 2 && !reduced()) {
          const [ta, xa] = recent[0];
          const [tb, xb] = recent[recent.length - 1];
          const v = (xb - xa) / Math.max(16, tb - ta);
          if (Math.abs(v) > 0.22) {
            fling = { v: Math.max(-4, Math.min(4, v)), last: now };
            loop();
            return;
          }
        }
        finishMove();
      };
      els.reel.addEventListener('pointermove', move);
      els.reel.addEventListener('pointerup', up);
      els.reel.addEventListener('pointercancel', up);
    });

    // Тачпад и колесо с Shift: лента едет вбок, страница не прокручивается.
    els.reel.addEventListener('wheel', (event) => {
      if (!ready()) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
      if (!delta) return;
      event.preventDefault();
      glide = null;
      fling = null;
      setStart(draft().startAt + delta / PX_PER_SEC, true);
    }, { passive: false });

    els.reel.addEventListener('keydown', (event) => {
      const d = draft();
      if (!d || !d.ready) return;
      const steps = { ArrowLeft: -0.1, ArrowRight: 0.1, ArrowDown: -1, ArrowUp: 1, PageDown: -5, PageUp: 5 };
      let next = null;
      if (event.key in steps) next = d.startAt + steps[event.key] * (event.shiftKey ? 10 : 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = d.track.duration;
      else if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); togglePlay(); return; }
      if (next === null) return;
      event.preventDefault();
      setStart(Math.round(next * 100) / 100);
    });

    // Вся песня: касание или ведение пальцем переносит иглу в это место.
    els.map.addEventListener('pointerdown', (event) => {
      if (!ready() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      try { els.map.setPointerCapture(event.pointerId); } catch (_) { /* — */ }
      const resume = own() && Player.isPlaying();
      if (resume) Player.pause();
      const at = (clientX) => {
        const rect = els.map.getBoundingClientRect();
        return clamp01((clientX - rect.left) / Math.max(1, rect.width)) * draft().track.duration;
      };
      glideTo(at(event.clientX), 320);
      const move = (e) => {
        glide = null;
        setStart(at(e.clientX), true);
      };
      const up = () => {
        els.map.removeEventListener('pointermove', move);
        els.map.removeEventListener('pointerup', up);
        els.map.removeEventListener('pointercancel', up);
        resumeAfter = resume;
        if (!glide) finishMove();
      };
      els.map.addEventListener('pointermove', move);
      els.map.addEventListener('pointerup', up);
      els.map.addEventListener('pointercancel', up);
    });

    els.top.addEventListener('click', () => {
      if (hint === null) return;
      haptic.tap();
      resumeAfter = true;
      glideTo(hint, 620);
    });
    els.play.addEventListener('click', togglePlay);
    els.back.addEventListener('click', () => { haptic.tap(); ctx.back(); });
    els.save.addEventListener('click', () => ctx.save());

    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { if (!els.view.hidden) paint(); }).observe(els.reel);
    }

    return {
      el: els.view,
      prepare,
      abort,
      render,
      paintTime: loop,
      paintPlay,
      show() { loop(); paint(); },
      dragging: () => dragging,
    };
  }

  window.NvMusicStart = Object.freeze({ create });
})();
