/* nvate studio — выбор начала песни.

   Второй экран музыкальной библиотеки: после «Tanlash» пара ставит точный
   момент, с которого песня зазвучит у гостей, слушает его и сохраняет. Шкала —
   волна самой песни, если файл удалось прочитать, иначе ровная лента времени с
   делениями; работают они одинаково: тап или перетаскивание ставит начало,
   кнопки сдвигают его на секунду и на десятую. Всё, что правее отметки,
   подсвечено золотом — это и услышат гости. */
(function () {
  'use strict';

  const NUDGES = [-1, -0.1, 0.1, 1];
  const DECK_HEIGHT = 92;

  function create(ctx) {
    const { store, Core, Player, h, w, icon, cover, haptic, toast } = ctx;
    const els = {};
    let peaks = null;
    let job = null;          // AbortController подготовки: длительность, волна, подсказка
    let hint = null;
    let dragging = false;

    const draft = () => store.get().draft;
    const own = () => ctx.getOwner() === 'start';

    /* ── Разметка ── */

    els.cover = h('span', { class: 'mlib-cover mlib-cover--lg' });
    els.title = h('b');
    els.artist = h('span');
    els.label = h('span', { class: 'mstart-label-txt' });
    els.read = h('b', { class: 'mstart-read' }, '00:00.0');
    els.canvas = h('canvas', { class: 'mstart-canvas', 'aria-hidden': 'true' });
    els.shade = h('span', { class: 'mstart-shade', 'aria-hidden': 'true' });
    els.head = h('span', { class: 'mstart-head', 'aria-hidden': 'true' });
    els.marker = h('span', { class: 'mstart-marker', role: 'slider', tabindex: '0', 'aria-valuemin': '0' }, h('i', {}));
    els.deck = h('div', { class: 'mstart-deck is-loading' }, els.canvas, els.shade, els.head, els.marker);
    els.zero = h('span', {}, '00:00');
    els.end = h('span', {}, '');
    els.nudges = NUDGES.map((delta) => {
      const text = `${delta > 0 ? '+' : '−'}${Math.abs(delta) >= 1 ? '1 s' : '0.1'}`;
      const button = h('button', { type: 'button', class: 'mstart-nudge' }, text);
      button.addEventListener('click', () => nudge(delta));
      return button;
    });
    els.top = h('button', { type: 'button', class: 'mstart-top', hidden: true });
    els.play = h('button', { type: 'button', class: 'btn btn--ghost btn--block mstart-play' },
      icon('play', true), icon('pause'), h('span', { class: 'mstart-play-txt' }));
    els.back = h('button', { type: 'button', class: 'btn btn--ghost mstart-back' });
    els.save = h('button', { type: 'button', class: 'btn btn--gold mstart-save' });

    els.view = h('div', { class: 'mlib-view mlib-view--start', hidden: true },
      h('div', { class: 'mstart-body' },
        h('div', { class: 'mstart-track' }, els.cover, h('div', { class: 'mstart-info' }, els.title, els.artist)),
        h('div', { class: 'mstart-stage' },
          h('p', { class: 'mstart-label' }, els.label, els.read),
          els.deck,
          h('div', { class: 'mstart-scale' }, els.zero, els.end)),
        h('div', { class: 'mstart-tools' }, ...els.nudges, els.top),
        els.play),
      h('footer', { class: 'mstart-foot' }, els.back, els.save));

    /* ── Подготовка песни ── */

    function abort() {
      if (job) job.abort();
      job = null;
      hint = null;
      peaks = null;
    }

    async function prepare(track) {
      abort();
      const current = new AbortController();
      job = current;
      const { signal } = current;
      const key = Core.trackKey(track);
      paintTrack(track);
      let duration = Number(track.duration) || 0;
      if (!duration && track.playback === 'audio') duration = await NvMusicPlayer.probeDuration(track.audioUrl, signal);
      if (!duration && track.playback === 'youtube') duration = await Player.youtubeDuration(track, signal);
      if (signal.aborted) return;
      if (!(duration > 0)) {
        toast(w('trackError'), 'err');
        store.dispatch({ type: 'back' });
        return;
      }
      store.dispatch({ type: 'draft:ready', key, duration });
      loadHint(track, signal);
      if (track.playback === 'audio') {
        NvMusicPlayer.loadPeaks(track.audioUrl, signal).then((wave) => {
          if (signal.aborted || Core.trackKey(draft()?.track) !== key) return;
          peaks = wave;
          paintDeck();
        }, () => { /* источник не пустил или не прочитался — остаётся шкала времени */ });
      }
    }

    async function loadHint(track, signal) {
      try {
        const query = new URLSearchParams({ provider: track.provider, id: track.id });
        const data = await ctx.api(`/api/music/hint?${query}`, { signal });
        const d = draft();
        if (signal.aborted || !d || !data.hint) return;
        const at = Number(data.hint.start);
        if (Number.isFinite(at) && at > 0 && at < d.track.duration - 1) {
          hint = at;
          render();
        }
      } catch (_) { /* подсказки нет — выбирают сами */ }
    }

    /* ── Рисунок ── */

    function sceneRgb() {
      const style = getComputedStyle(document.documentElement);
      const rgb = ['--scene-r', '--scene-g', '--scene-b'].map((k) => Math.round(Number(style.getPropertyValue(k))));
      return rgb.every(Number.isFinite) && rgb.some(Boolean) ? rgb : [215, 168, 63];
    }

    function paintDeck() {
      const d = draft();
      const width = Math.max(1, Math.round(els.deck.clientWidth));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      els.canvas.width = Math.round(width * dpr);
      els.canvas.height = Math.round(DECK_HEIGHT * dpr);
      els.canvas.style.width = `${width}px`;
      els.canvas.style.height = `${DECK_HEIGHT}px`;
      const g = els.canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, DECK_HEIGHT);
      if (!d || !d.ready) return;
      const duration = d.track.duration;
      const startX = (d.startAt / duration) * width;
      const [r, gg, b] = sceneRgb();
      const gold = g.createLinearGradient(0, 0, 0, DECK_HEIGHT);
      gold.addColorStop(0, `rgb(${Math.min(255, r + 40)}, ${Math.min(255, gg + 44)}, ${Math.min(255, b + 70)})`);
      gold.addColorStop(0.5, '#fff6e2');
      gold.addColorStop(1, `rgb(${r}, ${gg}, ${b})`);
      const mid = DECK_HEIGHT / 2 - 8;
      const bar = (x, top, w2, height) => {
        if (g.roundRect) g.roundRect(x, top, w2, height, w2 / 2);
        else g.rect(x, top, w2, height);
      };

      if (peaks) {
        const pitch = 4;
        const barW = 2.4;
        const count = Math.floor(width / pitch);
        const perBar = (duration / count) * peaks.rate;
        for (const lit of [false, true]) {
          g.beginPath();
          for (let i = 0; i < count; i += 1) {
            const x = i * pitch;
            if ((x + barW > startX) !== lit) continue;
            const from = Math.floor(i * perBar);
            const to = Math.min(peaks.peaks.length, Math.max(from + 1, Math.floor((i + 1) * perBar)));
            let v = 0;
            for (let k = from; k < to; k += 1) if (peaks.peaks[k] > v) v = peaks.peaks[k];
            const height = Math.max(3, v * (DECK_HEIGHT - 34));
            bar(x, mid - height / 2, barW, height);
          }
          g.fillStyle = lit ? gold : 'rgba(247, 241, 231, .24)';
          g.fill();
        }
      } else {
        g.beginPath();
        bar(0, mid - 2, width, 4);
        g.fillStyle = 'rgba(247, 241, 231, .16)';
        g.fill();
        g.beginPath();
        bar(startX, mid - 2, Math.max(4, width - startX), 4);
        g.fillStyle = gold;
        g.fill();
      }

      // Деления времени: подписи — только у крупных.
      const step = duration > 360 ? 60 : duration > 120 ? 30 : 15;
      g.font = '500 10px "Golos Text", sans-serif';
      g.textBaseline = 'top';
      for (let s = 0; s <= duration; s += step / 3) {
        const x = Math.round((s / duration) * width);
        const major = Math.abs((s / step) - Math.round(s / step)) < 1e-6;
        g.fillStyle = major ? 'rgba(247, 241, 231, .42)' : 'rgba(247, 241, 231, .18)';
        g.fillRect(x, DECK_HEIGHT - 22, 1, major ? 7 : 3);
        if (major && s > 0 && x < width - 34) {
          g.fillStyle = 'rgba(247, 241, 231, .46)';
          g.fillText(Core.clock(s), x + 4, DECK_HEIGHT - 20);
        }
      }
      if (hint !== null) {
        const x = (hint / duration) * width;
        g.fillStyle = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, gg + 30)}, ${Math.min(255, b + 50)})`;
        g.beginPath();
        g.moveTo(x, DECK_HEIGHT - 30);
        g.lineTo(x + 4, DECK_HEIGHT - 26);
        g.lineTo(x, DECK_HEIGHT - 22);
        g.lineTo(x - 4, DECK_HEIGHT - 26);
        g.closePath();
        g.fill();
      }
    }

    function paintTrack(track) {
      els.cover.replaceChildren(...cover(track));
      els.title.textContent = track.title;
      els.artist.textContent = track.artist || '';
      peaks = null;
      hint = null;
    }

    function paintMarker() {
      const d = draft();
      const share = d && d.ready ? Math.min(100, (d.startAt / d.track.duration) * 100) : 0;
      els.marker.style.left = `${share}%`;
      els.shade.style.width = `${share}%`;
      els.marker.setAttribute('aria-valuenow', String(d ? d.startAt : 0));
      els.marker.setAttribute('aria-valuetext', Core.clock(d ? d.startAt : 0, true));
      if (d && d.ready) els.marker.setAttribute('aria-valuemax', String(d.track.duration));
    }

    function paintPlay(playing = own() && Player.isPlaying()) {
      els.view.classList.toggle('is-playing', playing);
      els.play.querySelector('.mstart-play-txt').textContent = playing ? w('pause') : w('playFrom');
      if (!playing) els.head.classList.remove('is-on');
    }

    function paintTime() {
      const d = draft();
      if (!d || !d.ready || !own()) return;
      const at = Player.time();
      els.head.classList.add('is-on');
      els.head.style.left = `${Math.min(100, (at / d.track.duration) * 100)}%`;
    }

    function render() {
      const s = store.get();
      const d = s.draft;
      els.label.textContent = w('startLabel');
      els.back.textContent = w('back');
      els.save.textContent = s.saving ? w('saving') : w('save');
      els.marker.setAttribute('aria-label', w('startSlider'));
      els.nudges.forEach((button, i) => button.setAttribute('aria-label', w('nudge', NUDGES[i])));
      if (!d) return;
      els.deck.classList.toggle('is-loading', !d.ready);
      els.read.textContent = Core.clock(d.startAt, true);
      els.end.textContent = d.ready ? Core.clock(d.track.duration) : '';
      els.save.disabled = !d.ready || s.saving;
      els.play.disabled = !d.ready;
      els.nudges.forEach((button) => { button.disabled = !d.ready; });
      els.top.hidden = hint === null || Math.abs(hint - d.startAt) < 0.5;
      if (!els.top.hidden) els.top.replaceChildren(h('span', {}, w('top')), h('b', {}, Core.clock(hint)));
      paintMarker();
      paintDeck();
      paintPlay();
    }

    /* ── Действия ── */

    function setStart(at) {
      store.dispatch({ type: 'start', startAt: at });
    }

    function nudge(delta) {
      const d = draft();
      if (!d || !d.ready) return;
      haptic.tap();
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
    }

    function togglePlay() {
      const d = draft();
      if (!d || !d.ready) return;
      haptic.tap();
      if (own() && Player.isPlaying()) Player.pause();
      else playFrom();
    }

    function atPointer(clientX) {
      const d = draft();
      const rect = els.deck.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      return Math.round(ratio * d.track.duration * 20) / 20;
    }

    els.deck.addEventListener('pointerdown', (event) => {
      const d = draft();
      if (!d || !d.ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      try { els.deck.setPointerCapture(event.pointerId); } catch (_) { /* старый браузер */ }
      const resume = own() && Player.isPlaying();
      if (resume) Player.pause();
      dragging = true;
      els.deck.classList.add('is-dragging');
      setStart(atPointer(event.clientX));
      const move = (e) => { if (dragging) setStart(atPointer(e.clientX)); };
      const up = (e) => {
        els.deck.removeEventListener('pointermove', move);
        els.deck.removeEventListener('pointerup', up);
        els.deck.removeEventListener('pointercancel', up);
        dragging = false;
        els.deck.classList.remove('is-dragging');
        if (e.type === 'pointerup') setStart(atPointer(e.clientX));
        haptic.tap();
        if (resume) playFrom();
      };
      els.deck.addEventListener('pointermove', move);
      els.deck.addEventListener('pointerup', up);
      els.deck.addEventListener('pointercancel', up);
    });

    els.marker.addEventListener('keydown', (event) => {
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

    els.top.addEventListener('click', () => {
      if (hint === null) return;
      haptic.tap();
      setStart(hint);
      playFrom();
    });
    els.play.addEventListener('click', togglePlay);
    els.back.addEventListener('click', () => { haptic.tap(); ctx.back(); });
    els.save.addEventListener('click', () => ctx.save());

    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!els.view.hidden) paintDeck(); }).observe(els.deck);

    return {
      el: els.view,
      prepare,
      abort,
      render,
      paintTime,
      paintPlay,
      dragging: () => dragging,
    };
  }

  window.NvMusicStart = Object.freeze({ create });
})();
