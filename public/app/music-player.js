/* global YT */
/* nvate studio — единый плеер музыки.

   Во всей студии звучит что-то одно: плеер один, и новая песня сначала глушит
   прежнюю. Движков два. Обычный звук (своя музыка, песни уже оформленных
   приглашений) играет одним переиспользуемым <audio>. YouTube — официальным
   IFrame Player API. Снаружи разницы нет: load, play, pause, seek, time,
   duration, громкость с плавным затуханием и события playing / paused / ended /
   loading / duration / error / stopped.

   Здесь же — рисунок волны: файл декодируется в браузере, и если источник не
   пустил (CORS) или декодер не справился, это не ошибка — выбор начала просто
   покажет шкалу времени. */
(function () {
  'use strict';

  const API_SRC = 'https://www.youtube.com/iframe_api';
  const BLOCK_WAIT = 3500;   // столько ждём, что YouTube зазвучит сам, прежде чем попросить касание

  const Player = (() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const listeners = new Set();
    let track = null;
    let engine = '';
    let seq = 0;
    let yt = null;
    let ytReady = false;
    let ytHost = null;
    let ytBuilding = null;
    let apiPromise = null;
    let blockTimer = 0;
    let onBlocked = null;
    let level = 1;             // громкость 0…1, одна на оба движка
    let fadeTimer = 0;
    let fadeDone = null;

    const emit = (type, detail = {}) => {
      const payload = { track, ...detail };
      listeners.forEach((listener) => {
        try { listener(type, payload); } catch (error) { console.error('[music] listener failed', error); }
      });
    };

    audio.addEventListener('playing', () => { if (engine === 'audio') emit('playing'); });
    audio.addEventListener('pause', () => { if (engine === 'audio' && !audio.ended) emit('paused'); });
    audio.addEventListener('waiting', () => { if (engine === 'audio') emit('loading'); });
    audio.addEventListener('ended', () => { if (engine === 'audio') emit('ended'); });
    audio.addEventListener('loadedmetadata', () => {
      if (engine === 'audio' && Number.isFinite(audio.duration)) emit('duration', { duration: audio.duration });
    });
    // После stop() атрибута src нет — пустой источник ошибкой не считается.
    audio.addEventListener('error', () => {
      if (engine === 'audio' && audio.getAttribute('src')) emit('error', { code: 'unavailable' });
    });

    /* ── Громкость ──
       Затухание — плавная кривая, а не прямая: на слух прямая «обрывается» в
       самом конце. Где браузер громкость не отдаёт (iOS держит <audio> на
       максимуме), затухание просто молча длится своё время. */

    function applyVolume(value) {
      level = Math.min(1, Math.max(0, value));
      if (engine === 'audio') {
        try { audio.volume = level; } catch (_) { /* громкость только для чтения */ }
      } else if (engine === 'youtube' && yt && ytReady) {
        try { yt.setVolume(Math.round(level * 100)); } catch (_) { /* плеер пересоздаётся */ }
      }
    }

    function clearFade() {
      clearTimeout(fadeTimer);
      fadeTimer = 0;
      if (fadeDone) {
        const done = fadeDone;
        fadeDone = null;
        done(false);
      }
    }

    function setVolume(value) {
      clearFade();
      applyVolume(value);
    }

    /* Плавно к громкости to за ms. true — дошли до конца, false — прервали. */
    function fade(to, ms) {
      clearFade();
      const from = level;
      const target = Math.min(1, Math.max(0, to));
      const began = Date.now();
      const mine = seq;
      return new Promise((resolve) => {
        fadeDone = resolve;
        const tick = () => {
          if (mine !== seq) {
            fadeTimer = 0;
            fadeDone = null;
            resolve(false);
            return;
          }
          const p = Math.min(1, (Date.now() - began) / Math.max(1, ms));
          const rest = 1 - p * p * (3 - 2 * p);
          applyVolume(target + (from - target) * rest * rest);
          if (p < 1) {
            fadeTimer = setTimeout(tick, 40);
            return;
          }
          fadeTimer = 0;
          fadeDone = null;
          resolve(true);
        };
        tick();
      });
    }

    /* ── YouTube ── */

    function loadApi() {
      if (window.YT && window.YT.Player) return Promise.resolve();
      if (apiPromise) return apiPromise;
      apiPromise = new Promise((resolve, reject) => {
        const prior = window.onYouTubeIframeAPIReady;
        const guard = setTimeout(() => { apiPromise = null; reject(new Error('youtube api timeout')); }, 15000);
        window.onYouTubeIframeAPIReady = () => {
          clearTimeout(guard);
          if (typeof prior === 'function') { try { prior(); } catch (_) { /* чужой обработчик */ } }
          resolve();
        };
        const tag = document.createElement('script');
        tag.src = API_SRC;
        tag.async = true;
        tag.onerror = () => { clearTimeout(guard); apiPromise = null; tag.remove(); reject(new Error('youtube api failed')); };
        document.head.appendChild(tag);
      });
      return apiPromise;
    }

    function onYtState(event) {
      if (engine !== 'youtube' || !window.YT) return;
      const S = YT.PlayerState;
      if (event.data === S.PLAYING) {
        clearTimeout(blockTimer);
        reveal(false);
        try { yt.setVolume(Math.round(level * 100)); } catch (_) { /* — */ }
        emit('playing');
        try { emit('duration', { duration: yt.getDuration() }); } catch (_) { /* плеер ещё не знает */ }
      } else if (event.data === S.PAUSED || event.data === S.CUED) emit('paused');
      else if (event.data === S.BUFFERING) emit('loading');
      else if (event.data === S.ENDED) emit('ended');
    }

    function ensureYouTube() {
      if (yt && ytReady) return Promise.resolve(yt);
      if (ytBuilding) return ytBuilding;
      ytBuilding = loadApi().then(() => new Promise((resolve, reject) => {
        ytHost = document.createElement('div');
        ytHost.className = 'mlib-yt';
        const slot = document.createElement('div');
        const hint = document.createElement('p');
        hint.className = 'mlib-yt-hint';
        ytHost.append(slot, hint);
        document.body.appendChild(ytHost);
        const guard = setTimeout(() => reject(new Error('youtube player timeout')), 15000);
        yt = new YT.Player(slot, {
          width: 200,
          height: 200,
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3 },
          events: {
            onReady: () => { clearTimeout(guard); ytReady = true; resolve(yt); },
            onStateChange: onYtState,
            // 2 — неверный id, 5 — ошибка плеера, 100 — ролик удалён или закрыт, 101/150 — автор запретил встраивание.
            onError: () => { if (engine === 'youtube') { clearTimeout(blockTimer); reveal(false); emit('error', { code: 'unavailable' }); } },
          },
        });
      })).catch((error) => {
        destroyYouTube();
        throw error;
      }).finally(() => { ytBuilding = null; });
      return ytBuilding;
    }

    /* Браузер не дал плееру зазвучать без касания (iOS): показываем сам ролик,
       и касание по нему включает песню. */
    function reveal(on) {
      if (!ytHost) return;
      ytHost.classList.toggle('is-reveal', on);
      if (on && onBlocked) onBlocked(ytHost.querySelector('.mlib-yt-hint'));
    }

    function watchBlocked(mine) {
      clearTimeout(blockTimer);
      blockTimer = setTimeout(() => {
        if (mine !== seq || engine !== 'youtube' || !yt || !ytReady) return;
        let state = -1;
        try { state = yt.getPlayerState(); } catch (_) { /* плеер пересоздаётся */ }
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
          emit('paused', { blocked: true });
          reveal(true);
        }
      }, BLOCK_WAIT);
    }

    function destroyYouTube() {
      clearTimeout(blockTimer);
      if (yt) { try { yt.destroy(); } catch (_) { /* уже снят */ } }
      yt = null;
      ytReady = false;
      if (ytHost) ytHost.remove();
      ytHost = null;
    }

    /* ── Общий интерфейс ── */

    function playAudio() {
      const mine = seq;
      const pending = audio.play();
      if (pending && pending.catch) {
        pending.catch((error) => {
          if (mine !== seq) return;
          if (error && error.name === 'NotAllowedError') emit('paused', { blocked: true });
          else if (!error || error.name !== 'AbortError') emit('error', { code: 'unavailable' });
        });
      }
    }

    function seekAudio(at) {
      const mine = seq;
      const apply = () => {
        if (mine !== seq) return;
        try { audio.currentTime = Math.max(0, at); } catch (_) { /* поток ещё не готов */ }
      };
      if (audio.readyState >= 1) apply();
      else audio.addEventListener('loadedmetadata', apply, { once: true });
    }

    function halt() {
      clearTimeout(blockTimer);
      reveal(false);
      if (!audio.paused) audio.pause();
      if (yt && ytReady) { try { yt.stopVideo(); } catch (_) { /* — */ } }
    }

    async function load(next, { at = 0, autoplay = true } = {}) {
      const mine = ++seq;
      clearFade();
      halt();
      track = next;
      engine = next.playback === 'youtube' ? 'youtube' : 'audio';
      applyVolume(1);
      emit('loading');
      if (engine === 'audio') {
        if (yt && ytReady) { try { yt.stopVideo(); } catch (_) { /* — */ } }
        audio.src = next.audioUrl;
        seekAudio(at);
        if (autoplay) playAudio();
        return;
      }
      if (audio.getAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
      try {
        await ensureYouTube();
      } catch (_) {
        if (mine === seq) emit('error', { code: 'unavailable' });
        return;
      }
      if (mine !== seq) return;
      applyVolume(level);
      const options = { videoId: next.id, startSeconds: Math.max(0, at) };
      try {
        if (autoplay) {
          yt.loadVideoById(options);
          watchBlocked(mine);
        } else {
          yt.cueVideoById(options);
        }
      } catch (_) {
        emit('error', { code: 'unavailable' });
      }
    }

    function play() {
      if (!track) return;
      if (engine === 'audio') { playAudio(); return; }
      if (yt && ytReady) {
        try { yt.playVideo(); } catch (_) { /* — */ }
        watchBlocked(seq);
      }
    }

    function pause() {
      clearTimeout(blockTimer);
      if (engine === 'audio') audio.pause();
      else if (yt && ytReady) { try { yt.pauseVideo(); } catch (_) { /* — */ } }
    }

    function seek(at) {
      const to = Math.max(0, Number(at) || 0);
      if (engine === 'audio') { try { audio.currentTime = to; } catch (_) { /* — */ } }
      else if (yt && ytReady) { try { yt.seekTo(to, true); } catch (_) { /* — */ } }
    }

    function time() {
      if (engine === 'audio') return audio.currentTime || 0;
      if (engine === 'youtube' && yt && ytReady) { try { return yt.getCurrentTime() || 0; } catch (_) { return 0; } }
      return 0;
    }

    function duration() {
      if (engine === 'audio') return Number.isFinite(audio.duration) ? audio.duration : 0;
      if (engine === 'youtube' && yt && ytReady) { try { return yt.getDuration() || 0; } catch (_) { return 0; } }
      return 0;
    }

    function isPlaying() {
      if (engine === 'audio') return !audio.paused && !audio.ended;
      if (engine === 'youtube' && yt && ytReady && window.YT) {
        try { return yt.getPlayerState() === YT.PlayerState.PLAYING; } catch (_) { return false; }
      }
      return false;
    }

    function stop() {
      seq += 1;
      clearFade();
      halt();
      if (audio.getAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
      const was = track;
      track = null;
      engine = '';
      if (was) emit('stopped', { track: was });
    }

    /* Длительность ролика, когда поиск её не сообщил: ставим ролик в очередь и
       ждём, пока плеер её узнает. */
    async function youtubeDuration(next, signal) {
      try { await ensureYouTube(); } catch (_) { return 0; }
      if (signal && signal.aborted) return 0;
      const mine = ++seq;
      halt();
      track = next;
      engine = 'youtube';
      try { yt.cueVideoById({ videoId: next.id }); } catch (_) { return 0; }
      for (let i = 0; i < 40; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (mine !== seq || (signal && signal.aborted)) return 0;
        const value = duration();
        if (value > 0) return value;
      }
      return 0;
    }

    return {
      load, play, pause, seek, time, duration, isPlaying, stop, youtubeDuration, setVolume, fade,
      volume: () => level,
      warmYouTube: () => ensureYouTube().catch(() => null),
      destroyYouTube,
      destroy() { stop(); destroyYouTube(); },
      current: () => track,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      onBlocked(fn) { onBlocked = fn; },
    };
  })();

  /* Длительность файла без проигрывания: хватает метаданных. */
  function probeDuration(url, signal) {
    return new Promise((resolve) => {
      const probe = new Audio();
      probe.preload = 'metadata';
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute('src');
        try { probe.load(); } catch (_) { /* — */ }
        resolve(value);
      };
      const guard = setTimeout(() => done(0), 12000);
      probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : 0);
      probe.onerror = () => done(0);
      if (signal) signal.addEventListener('abort', () => done(0), { once: true });
      probe.src = url;
    });
  }

  /* Волна: громкость по 20 точек на секунду, нормированная по 95-му перцентилю —
     тихая запись не выглядит пустой, громкая — сплошной стеной. */
  const RATE = 20;
  async function loadPeaks(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('audio unavailable');
    if (Number(response.headers.get('content-length')) > 40 * 1024 * 1024) throw new Error('audio too large');
    const bytes = await response.arrayBuffer();
    if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error('no audio context');
    let context;
    try { context = new Offline(1, 1, 8000); } catch (_) { context = new Offline(1, 1, 44100); }
    const buffer = await new Promise((resolve, reject) => {
      const pending = context.decodeAudioData(bytes, resolve, reject);
      if (pending && typeof pending.then === 'function') pending.then(resolve, reject);
    });
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const step = Math.max(1, Math.floor(buffer.sampleRate / RATE));
    const count = Math.ceil(buffer.length / step);
    const peaks = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const to = Math.min(buffer.length, (i + 1) * step);
      let peak = 0;
      for (let s = i * step; s < to; s += 2) {
        let v = 0;
        for (const data of channels) v += Math.abs(data[s]);
        v /= channels.length;
        if (v > peak) peak = v;
      }
      peaks[i] = peak;
    }
    const sorted = Array.from(peaks).sort((a, b) => a - b);
    const ceiling = sorted[Math.floor(sorted.length * 0.95)] || 1;
    for (let i = 0; i < count; i += 1) peaks[i] = Math.min(1, Math.pow(peaks[i] / ceiling, 0.85));
    return { peaks, rate: RATE, duration: buffer.duration };
  }

  window.NvMusicPlayer = Object.freeze({ Player, probeDuration, loadPeaks });
})();
