/* nvate studio — музыка: ядро без DOM.

   Одно состояние музыкального шага и один редьюсер вместо россыпи флагов по
   обработчикам; поиск, которому не страшны гонки ответов; задачи импорта
   (ссылка, видео, звук ролика YouTube); перевод черновиков прошлых версий
   студии. Разметки и звука здесь нет — поэтому ядро проверяется тестами в Node
   так же, как сервер (test/platform.test.js). */
(function (root) {
  'use strict';

  const PHASE = Object.freeze({
    IDLE: 'IDLE',
    SEARCHING: 'SEARCHING',
    RESULTS: 'RESULTS',
    PREVIEWING: 'PREVIEWING',
    IMPORTING: 'IMPORTING',
    SELECTED: 'SELECTED',
    CHOOSING_START: 'CHOOSING_START',
    SAVING: 'SAVING',
    SAVED: 'SAVED',
    ERROR: 'ERROR',
  });

  // Все источники, чьи песни ещё играют в приглашениях. Выбирают новые — только из двух.
  const PROVIDERS = ['nvate', 'audius', 'youtube', 'upload'];
  const STUDIO_PROVIDERS = ['youtube', 'upload'];
  const JOB_STATUS = ['uploading', 'queued', 'working', 'done', 'error'];
  const MIN_QUERY = 2;
  const VOLUME = Object.freeze({ min: 0.1, max: 1 });
  const round2 = (n) => Math.round(n * 100) / 100;

  /* 74.35 → «01:14», с долями — «01:14.3». */
  function clock(seconds, fraction = false) {
    const total = Math.max(0, Number(seconds) || 0);
    const whole = Math.floor(total + 1e-6);
    const text = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    return fraction ? `${text}.${Math.min(9, Math.floor((total - whole) * 10 + 1e-6))}` : text;
  }

  const trackKey = (track) => (track ? `${track.provider}:${track.id}` : '');

  /* Карточка, пришедшая с сервера, годится, только если её можно проиграть. */
  function validTrack(track) {
    if (!track || typeof track !== 'object') return false;
    if (typeof track.id !== 'string' || !track.id || !PROVIDERS.includes(track.provider)) return false;
    if (typeof track.title !== 'string') return false;
    if (track.playback === 'youtube') return track.provider === 'youtube';
    return track.playback === 'audio' && typeof track.audioUrl === 'string' && track.audioUrl.startsWith('/');
  }

  /* Не дальше чем за полсекунды до конца: песня должна успеть зазвучать. */
  function clampStart(value, duration) {
    const n = Number(value);
    let at = Number.isFinite(n) && n > 0 ? n : 0;
    const d = Number(duration);
    if (Number.isFinite(d) && d > 0) at = Math.min(at, Math.max(0, d - 0.5));
    return round2(at);
  }

  /* Выбор песни — то, что лежит в черновике и уходит на сервер. */
  function normalizeSelection(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const provider = String(raw.provider || '');
    const trackId = String(raw.trackId ?? '');
    if (!PROVIDERS.includes(provider) || !trackId || trackId.length > 80) return null;
    const duration = Number(raw.duration);
    const cleanDuration = Number.isFinite(duration) && duration > 0 ? round2(duration) : null;
    const startAt = clampStart(raw.startAt, cleanDuration);
    const volume = Number(raw.volume);
    return {
      provider,
      trackId,
      title: String(raw.title || '').slice(0, 120) || 'Musiqa',
      artist: String(raw.artist || '').slice(0, 120),
      cover: typeof raw.cover === 'string' && /^(?:https:\/\/|\/(?!\/))/.test(raw.cover) ? raw.cover : null,
      duration: cleanDuration,
      startAt,
      volume: Number.isFinite(volume) ? Math.min(VOLUME.max, Math.max(VOLUME.min, round2(volume))) : 1,
    };
  }

  function toSelection(track, startAt) {
    if (!validTrack(track)) return null;
    return normalizeSelection({
      provider: track.provider,
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
      duration: track.duration,
      startAt,
      volume: 1,
    });
  }

  /* Карточка для плеера из сохранённого выбора. Адрес звука строится по тем же
     правилам, что и на сервере: сам выбор адресов не хранит. */
  function trackFromSelection(selection) {
    const sel = normalizeSelection(selection);
    if (!sel) return null;
    const track = {
      id: sel.trackId,
      provider: sel.provider,
      title: sel.title,
      artist: sel.artist,
      duration: sel.duration,
      cover: sel.cover,
      playback: sel.provider === 'youtube' ? 'youtube' : 'audio',
    };
    if (sel.provider === 'upload') track.audioUrl = `/uploads/${encodeURIComponent(sel.trackId)}`;
    else if (sel.provider !== 'youtube') track.audioUrl = `/api/music/audio/${sel.provider}/${encodeURIComponent(sel.trackId)}`;
    return track;
  }

  /* Черновики прошлых версий: песня лежала как { type, value, name, artist }.
     Файлы и ролики YouTube переносим; iTunes-превью и прямые ссылки — нет:
     их сервер больше не принимает, и пара выберет песню заново. */
  function migrateDraftMusic(music, musicStart) {
    if (!music || typeof music !== 'object') return null;
    if (music.provider) return normalizeSelection(music);
    if (music.type === 'upload' && /^[0-9a-f-]{36}\.(?:mp3|m4a|ogg|wav)$/.test(String(music.value || ''))) {
      return normalizeSelection({
        provider: 'upload', trackId: music.value, title: music.name, artist: music.artist,
        duration: music.duration, startAt: musicStart,
      });
    }
    if (music.type === 'youtube') {
      const id = String(music.value || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1];
      if (id) {
        return normalizeSelection({
          provider: 'youtube', trackId: id, title: music.name,
          artist: String(music.artist || '').replace(/^YouTube(?:\s·\s)?/, ''), startAt: musicStart,
        });
      }
    }
    return null;
  }

  /* Задача импорта глазами студии: загрузка файла, очередь, извлечение, итог. */
  function cleanJob(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
    const status = JOB_STATUS.includes(raw.status) ? raw.status : 'queued';
    const progress = Number(raw.progress);
    return {
      id: raw.id,
      kind: raw.kind === 'video' ? 'video' : raw.kind === 'file' ? 'file' : 'link',
      site: String(raw.site || ''),
      label: String(raw.label || '').slice(0, 120),
      status,
      stage: String(raw.stage || status),
      progress: raw.progress === null || raw.progress === undefined || !Number.isFinite(progress) ? null : Math.min(1, Math.max(0, progress)),
      error: status === 'error' ? String(raw.error || 'failed') : '',
      track: validTrack(raw.track) ? raw.track : null,
      auto: raw.auto === true,
    };
  }

  const jobActive = (job) => ['uploading', 'queued', 'working'].includes(job.status);

  /* ── Состояние ── */

  const IDLE_SEARCH = Object.freeze({ key: '', status: 'idle', items: [], next: null, more: false });
  const IDLE_PREVIEW = Object.freeze({ key: '', status: 'idle', error: '' });

  function initialState(saved = null) {
    const clean = normalizeSelection(saved);
    return {
      open: false,
      view: 'library',          // library | start
      provider: 'youtube',
      query: '',
      category: '',
      search: IDLE_SEARCH,      // status: idle | loading | ready | error
      preview: IDLE_PREVIEW,    // status: idle | loading | playing | paused | error
      draft: null,              // { track, startAt, ready }
      imports: [],              // задачи импорта, свежие сверху
      saving: false,
      saved: clean,
      phase: clean ? PHASE.SAVED : PHASE.IDLE,
    };
  }

  function phaseOf(s) {
    if (!s.open) return s.saved ? PHASE.SAVED : PHASE.IDLE;
    if (s.view === 'start') {
      if (s.saving) return PHASE.SAVING;
      return s.draft?.ready ? PHASE.CHOOSING_START : PHASE.SELECTED;
    }
    if (s.preview.key && ['loading', 'playing', 'paused'].includes(s.preview.status)) return PHASE.PREVIEWING;
    if (s.imports.some(jobActive)) return PHASE.IMPORTING;
    if (s.search.status === 'loading' && !s.search.more) return PHASE.SEARCHING;
    if (s.search.status === 'error') return PHASE.ERROR;
    if (s.search.status === 'ready') return PHASE.RESULTS;
    return PHASE.IDLE;
  }

  function dedupe(tracks) {
    const seen = new Set();
    return tracks.filter((track) => {
      const key = trackKey(track);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function reduce(state, action) {
    const s = { ...state };
    switch (action.type) {
      case 'open':
        if (s.open && !action.provider) return state;
        s.open = true;
        s.view = 'library';
        s.draft = null;
        s.saving = false;
        if (STUDIO_PROVIDERS.includes(action.provider)) s.provider = action.provider;
        break;
      case 'close':
        s.open = false;
        s.view = 'library';
        s.draft = null;
        s.saving = false;
        s.preview = IDLE_PREVIEW;
        break;
      case 'provider':
        if (!STUDIO_PROVIDERS.includes(action.provider) || action.provider === s.provider) return state;
        s.provider = action.provider;
        s.category = '';
        s.search = IDLE_SEARCH;
        s.preview = IDLE_PREVIEW;
        break;
      case 'query':
        s.query = String(action.query ?? '').slice(0, 100);
        break;
      case 'category':
        if ((action.category || '') === s.category) return state;
        s.category = action.category || '';
        break;
      case 'search:start':
        s.search = action.more
          ? { ...s.search, status: 'loading', more: true }
          : { key: action.key, status: 'loading', items: [], next: null, more: false };
        break;
      case 'search:done':
        // Ответ на уже неактуальный запрос не перезаписывает свежую выдачу.
        if (action.key !== s.search.key) return state;
        s.search = {
          key: action.key,
          status: 'ready',
          items: action.more ? dedupe([...s.search.items, ...action.items]) : dedupe(action.items),
          next: action.next ?? null,
          more: false,
        };
        break;
      case 'search:fail':
        if (action.key !== s.search.key) return state;
        s.search = action.more ? { ...s.search, status: 'ready', more: false } : { ...s.search, status: 'error', more: false };
        break;
      case 'search:idle':
        s.search = { ...IDLE_SEARCH, key: action.key || '' };
        break;
      case 'preview:load':
        s.preview = { key: action.key, status: 'loading', error: '' };
        break;
      case 'preview:playing':
      case 'preview:paused':
        if (action.key !== s.preview.key) return state;
        s.preview = { ...s.preview, status: action.type === 'preview:playing' ? 'playing' : 'paused' };
        break;
      case 'preview:error':
        if (action.key !== s.preview.key) return state;
        s.preview = { ...s.preview, status: 'error', error: action.error || 'failed' };
        break;
      case 'preview:stop':
        if (!s.preview.key) return state;
        s.preview = IDLE_PREVIEW;
        break;
      case 'select':
        if (!validTrack(action.track)) return state;
        s.open = true;
        s.view = 'start';
        s.preview = IDLE_PREVIEW;
        s.draft = { track: action.track, startAt: clampStart(action.startAt, action.track.duration), ready: false };
        break;
      case 'draft:ready': {
        if (!s.draft || action.key !== trackKey(s.draft.track)) return state;
        const duration = Number(action.duration) > 0 ? round2(Number(action.duration)) : null;
        if (!duration) return state;
        const track = { ...s.draft.track, duration };
        s.draft = { track, startAt: clampStart(s.draft.startAt, duration), ready: true };
        break;
      }
      /* Звук ролика YouTube скачан: черновик переезжает на свою песню с тем же
         началом — у неё есть настоящая волна, и гости услышат файл, а не плеер. */
      case 'draft:swap': {
        if (!s.draft || action.key !== trackKey(s.draft.track) || !validTrack(action.track)) return state;
        const own = Number(action.track.duration);
        const duration = Number.isFinite(own) && own > 0 ? round2(own) : s.draft.track.duration;
        const track = { ...action.track, duration };
        s.draft = { track, startAt: clampStart(s.draft.startAt, duration), ready: s.draft.ready || Boolean(duration > 0) };
        break;
      }
      case 'start':
        if (!s.draft) return state;
        s.draft = { ...s.draft, startAt: clampStart(action.startAt, s.draft.track.duration) };
        if (s.draft.startAt === state.draft.startAt) return state;
        break;
      case 'back':
        if (s.view !== 'start') return state;
        s.view = 'library';
        s.draft = null;
        s.saving = false;
        break;
      case 'save:start':
        if (!s.draft?.ready) return state;
        s.saving = true;
        break;
      case 'save:done':
        s.saved = normalizeSelection(action.selection);
        s.saving = false;
        s.open = false;
        s.view = 'library';
        s.draft = null;
        s.preview = IDLE_PREVIEW;
        break;
      case 'save:fail':
        s.saving = false;
        break;
      case 'saved':
        s.saved = normalizeSelection(action.selection);
        break;
      case 'import:add': {
        const job = cleanJob(action.job);
        if (!job) return state;
        s.imports = [job, ...s.imports.filter((item) => item.id !== job.id)].slice(0, 6);
        break;
      }
      case 'import:update': {
        const index = s.imports.findIndex((item) => item.id === action.job?.id);
        if (index < 0) return state;
        const job = cleanJob({ ...s.imports[index], ...action.job, auto: s.imports[index].auto });
        s.imports = s.imports.map((item, i) => (i === index ? job : item));
        break;
      }
      case 'import:remove':
        if (!s.imports.some((item) => item.id === action.id)) return state;
        s.imports = s.imports.filter((item) => item.id !== action.id);
        break;
      default:
        return state;
    }
    s.phase = phaseOf(s);
    return s;
  }

  function createStore(initial) {
    let state = initial;
    const listeners = new Set();
    return {
      get: () => state,
      dispatch(action) {
        const next = reduce(state, action);
        if (next === state) return state;
        const prev = state;
        state = next;
        listeners.forEach((listener) => listener(state, prev, action));
        return state;
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  /* ── Поиск ──
     Новый запрос отменяет прошлый (AbortController), а ответ, опоздавший к
     своему запросу, выбрасывается по ключу: быстрое «o → oh → oh s → oh sevaman»
     не даст ответу «oh s» перезаписать выдачу «oh sevaman». Паузу в наборе держит
     таймер; одна буква — ещё не запрос. */

  function searchParams(state) {
    const typed = state.query.trim();
    return {
      provider: state.provider,
      category: state.provider === 'nvate' ? state.category : '',
      query: typed.length >= MIN_QUERY ? typed : '',
    };
  }

  const searchKey = ({ provider, category, query }) => `${provider}|${category || ''}|${query.toLowerCase()}`;

  function createSearch({
    store,
    request,                              // ({ provider, query, category, page }, signal) → { items, next }
    browses = () => true,                 // показывает ли источник подборку без запроса
    personal = () => false,               // своя музыка пары не кешируется: её пополняет бот
    delay = 350,
    cacheTtl = 5 * 60_000,
    timers = root,
    now = () => Date.now(),
  }) {
    let timer = 0;
    let controller = null;
    const cache = new Map();

    function abort() {
      if (timer) timers.clearTimeout(timer);
      timer = 0;
      if (controller) controller.abort();
      controller = null;
    }

    async function run({ more = false, force = false, quiet = false } = {}) {
      const state = store.get();
      const params = searchParams(state);
      const key = searchKey(params);
      if (!params.query && !browses(params.provider)) {
        abort();
        store.dispatch({ type: 'search:idle', key });
        return;
      }
      const page = more ? state.search.next : 0;
      if (more && (page === null || page === undefined || state.search.key !== key || state.search.status !== 'ready')) return;
      if (!more && !force && !quiet && state.search.key === key && ['loading', 'ready'].includes(state.search.status)) return;

      const cacheKey = `${key}#${page}`;
      const hit = !force && !quiet && !personal(params.provider) ? cache.get(cacheKey) : null;
      if (hit && hit.until > now()) {
        abort();
        if (!more) store.dispatch({ type: 'search:start', key });
        else store.dispatch({ type: 'search:start', key, more: true });
        store.dispatch({ type: 'search:done', key, items: hit.items, next: hit.next, more });
        return;
      }

      abort();
      const own = new AbortController();
      controller = own;
      if (!quiet) store.dispatch({ type: 'search:start', key, more });
      try {
        const data = await request({ ...params, page }, own.signal);
        if (own.signal.aborted || store.get().search.key !== key) return;
        const items = (Array.isArray(data?.items) ? data.items : []).filter(validTrack);
        const next = Number.isInteger(data?.next) ? data.next : null;
        if (!personal(params.provider)) {
          cache.set(cacheKey, { items, next, until: now() + cacheTtl });
          if (cache.size > 60) cache.delete(cache.keys().next().value);
        }
        store.dispatch({ type: 'search:done', key, items, next, more });
      } catch (error) {
        if (own.signal.aborted || error?.name === 'AbortError') return;
        if (!quiet) store.dispatch({ type: 'search:fail', key, more });
      } finally {
        if (controller === own) controller = null;
      }
    }

    return {
      schedule() {
        if (timer) timers.clearTimeout(timer);
        timer = timers.setTimeout(() => { timer = 0; run(); }, delay);
      },
      now: (options) => run(options),
      more: () => run({ more: true }),
      retry: () => run({ force: true }),
      refresh: () => run({ quiet: true }),
      cancel: abort,
      forget: () => cache.clear(),
    };
  }

  root.NvMusicCore = Object.freeze({
    PHASE, PROVIDERS, STUDIO_PROVIDERS, MIN_QUERY, clock, trackKey, validTrack, clampStart,
    normalizeSelection, toSelection, trackFromSelection, migrateDraftMusic, cleanJob, jobActive,
    initialState, reduce, createStore, searchParams, searchKey, createSearch,
  });
})(typeof window !== 'undefined' ? window : globalThis);
