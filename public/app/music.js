/* global NvMusicCore, NvMusicPlayer, NvMusicStart */
/* nvate studio — музыкальная библиотека.

   Шаг «Musiqa» целиком: карточка выбранной песни и библиотека — nVate, Audius,
   YouTube и своя музыка пары. Порядок как в любом музыкальном приложении:
   нашёл → спокойно послушал несколько вариантов → «Tanlash» → выбрал точный
   момент начала → проверил → «Saqlash». Касание строки только включает песню;
   выбирает её одна кнопка.

   Источники студия не различает: сервер отдаёт одинаковые карточки Track, а
   звучат они через единый плеер (music-player.js). Состояние шага — одно, в
   music-core.js; экран выбора начала — music-start.js. */
(function () {
  'use strict';

  const Core = window.NvMusicCore;
  const { Player, probeDuration } = window.NvMusicPlayer;
  const { h, toast, haptic, tg } = window.UI;

  const WORDS = {
    uz: {
      title: 'Musiqa tanlash', searchPh: 'Musiqa qidirish...', clear: 'Tozalash', close: 'Yopish',
      providers: { nvate: 'nVate', audius: 'Audius', youtube: 'YouTube', upload: 'Mening musiqam' },
      categories: { wedding: 'To‘y', romantic: 'Romantik', uzbek: 'O‘zbekcha', piano: 'Pianino', classic: 'Klassik', emotional: 'Hissiyotli', chill: 'Sokin' },
      allCats: 'Hammasi', listen: 'Tinglash', pause: 'Pauza', take: 'Tanlash', more: 'Yana ko‘rsatish', retry: 'Qayta urinish',
      emptyTitle: 'Hech narsa topilmadi', emptyText: 'Boshqa so‘z bilan qidirib ko‘ring',
      shelfEmptyTitle: 'Bu bo‘limda hozircha qo‘shiq yo‘q', shelfEmptyText: 'Boshqa bo‘limni yoki qidiruvni sinab ko‘ring',
      ytPromptTitle: 'YouTube’dan qidiring', ytPromptText: 'Qo‘shiq yoki ijrochi nomini yozing',
      mineEmptyTitle: 'Hozircha qo‘shiq yo‘q', mineEmptyText: 'Qo‘shiqni botga yuboring yoki faylni yuklang — u shu yerda paydo bo‘ladi',
      errorTitle: 'Qo‘shiqlar ochilmadi', errorText: 'Aloqani tekshirib, qayta urinib ko‘ring',
      trackError: 'Bu qo‘shiqni ochib bo‘lmadi — boshqasini tanlang', tapVideo: 'Tinglash uchun videoga bosing',
      startTitle: 'Boshlanish vaqtini tanlang', startLabel: 'Boshlanish', playFrom: 'Shu yerdan tinglash',
      back: 'Orqaga', save: 'Saqlash', saving: 'Saqlanmoqda…', top: 'Top tanlov', startSlider: 'Boshlanish vaqti',
      nudge: (d) => `${Math.abs(d)} soniya ${d < 0 ? 'oldinroq' : 'keyinroq'}`,
      startsAt: (time) => `${time} dan boshlanadi`, fromStart: 'Boshidan boshlanadi',
      noneTitle: 'Musiqa tanlanmagan', noneText: 'Taklifnoma ochilganda mehmonlar eshitadigan qo‘shiqni tanlang',
      pick: 'Musiqa tanlash', change: 'O‘zgartirish', skip: 'Musiqasiz davom etish', remove: 'Musiqani olib tashlash',
      prev: 'Oldingi qo‘shiq', next: 'Keyingi qo‘shiq', seek: 'Qo‘shiqning joyi',
      botTitle: 'Qo‘shiqni botga yuboring', botText: 'Istalgan Telegram kanalidan qo‘shiqni botga forward qiling — u shu yerda to‘liq holda paydo bo‘ladi.',
      botOpen: 'Botni ochish', upload: 'Fayl yuklash', uploading: 'Yuklanmoqda…',
      uploadFail: 'Fayl yuklanmadi. Yana urinib ko‘ring', uploadBig: 'Fayl juda katta — 20 MB gacha',
      uploadFormat: 'Bu fayl qo‘shiq emas — MP3, M4A, OGG yoki WAV yuboring', mineFresh: (name) => `«${name}» botdan keldi`,
    },
    ru: {
      title: 'Выбор музыки', searchPh: 'Поиск музыки...', clear: 'Очистить', close: 'Закрыть',
      providers: { nvate: 'nVate', audius: 'Audius', youtube: 'YouTube', upload: 'Моя музыка' },
      categories: { wedding: 'Свадебные', romantic: 'Романтика', uzbek: 'Узбекские', piano: 'Пианино', classic: 'Классика', emotional: 'Трогательные', chill: 'Спокойные' },
      allCats: 'Все', listen: 'Слушать', pause: 'Пауза', take: 'Выбрать', more: 'Показать ещё', retry: 'Повторить',
      emptyTitle: 'Ничего не нашлось', emptyText: 'Попробуйте другие слова',
      shelfEmptyTitle: 'В этом разделе пока нет песен', shelfEmptyText: 'Загляните в другой раздел или воспользуйтесь поиском',
      ytPromptTitle: 'Поиск по YouTube', ytPromptText: 'Впишите название песни или исполнителя',
      mineEmptyTitle: 'Пока пусто', mineEmptyText: 'Пришлите песню боту или загрузите файл — она появится здесь',
      errorTitle: 'Не удалось загрузить песни', errorText: 'Проверьте связь и попробуйте ещё раз',
      trackError: 'Эту песню не удалось открыть — выберите другую', tapVideo: 'Нажмите на видео, чтобы послушать',
      startTitle: 'Выберите начало', startLabel: 'Начало', playFrom: 'Слушать отсюда',
      back: 'Назад', save: 'Сохранить', saving: 'Сохраняем…', top: 'Топ выбор', startSlider: 'Начало песни',
      nudge: (d) => `На ${Math.abs(d)} с ${d < 0 ? 'раньше' : 'позже'}`,
      startsAt: (time) => `Начинается с ${time}`, fromStart: 'Играет с начала',
      noneTitle: 'Музыка не выбрана', noneText: 'Выберите песню, которую гости услышат, открыв приглашение',
      pick: 'Выбрать музыку', change: 'Изменить', skip: 'Продолжить без музыки', remove: 'Убрать музыку',
      prev: 'Предыдущая песня', next: 'Следующая песня', seek: 'Место в песне',
      botTitle: 'Пришлите песню боту', botText: 'Перешлите трек боту из любого Telegram-канала — он появится здесь целиком.',
      botOpen: 'Открыть бота', upload: 'Загрузить файл', uploading: 'Загружаем…',
      uploadFail: 'Файл не загрузился. Попробуйте ещё раз', uploadBig: 'Файл слишком большой — до 20 МБ',
      uploadFormat: 'Это не песня — пришлите MP3, M4A, OGG или WAV', mineFresh: (name) => `«${name}» пришла из бота`,
    },
  };

  const PATHS = {
    play: ['M8 5.5v13l10.5-6.5z'],
    pause: ['M9 6v12', 'M15 6v12'],
    prev: ['M7 6v12', 'M18 6.5v11L9.5 12z'],
    next: ['M17 6v12', 'M6 6.5v11l8.5-5.5z'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    back: ['M15 5l-7 7 7 7'],
    search: ['M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z', 'M15.5 15.5L20 20'],
    note: ['M9 18V6l10-2v12', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M16 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
    send: ['M21 4L3 11l6.5 2.5L12 20l3-5.5L21 4z', 'M9.5 13.5L21 4'],
    retry: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  };

  const FALLBACK_PROVIDERS = [
    { id: 'nvate', browse: true, personal: false, categories: true },
    { id: 'audius', browse: true, personal: false },
    { id: 'youtube', browse: false, personal: false },
    { id: 'upload', browse: true, personal: true },
  ];

  let options = null;
  let store = null;
  let search = null;
  let start = null;
  let owner = null;          // кто сейчас звучит: library | start | card
  let built = false;
  let raf = 0;
  let hideTimer = 0;
  let poll = 0;
  let seeking = false;
  let mineSeen = null;
  const els = {};

  const lang = () => (options && options.lang() === 'ru' ? 'ru' : 'uz');
  function w(key, ...args) {
    const value = WORDS[lang()][key] ?? WORDS.uz[key];
    return typeof value === 'function' ? value(...args) : value;
  }

  function icon(name, filled = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `mic mic--${name}${filled ? ' mic--fill' : ''}`);
    for (const d of PATHS[name]) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  /* Обложка ложится поверх ноты: не загрузилась — остаётся нота. */
  function cover(track) {
    const nodes = [icon('note')];
    if (track && track.cover) {
      const img = h('img', { src: track.cover, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.remove());
      nodes.push(img);
    }
    return nodes;
  }

  const providers = () => {
    const list = options.config()?.providers;
    return Array.isArray(list) && list.length ? list : FALLBACK_PROVIDERS;
  };
  const providerInfo = (id) => providers().find((p) => p.id === id) || {};
  const categories = () => options.config()?.categories || ['wedding', 'romantic', 'uzbek', 'piano', 'classic', 'emotional', 'chill'];

  /* Запрос к API с тайм-аутом: зависший источник не держит студию. */
  async function api(path, { signal, auth = false, timeout = 15000 } = {}) {
    const inner = new AbortController();
    const timer = setTimeout(() => inner.abort(), timeout);
    const relay = () => inner.abort();
    if (signal) signal.addEventListener('abort', relay, { once: true });
    try {
      const response = await fetch(path, { signal: inner.signal, headers: auth ? { 'x-init-data': options.initData() } : undefined });
      let data = null;
      try { data = await response.json(); } catch (_) { data = null; }
      if (!response.ok || !data || !data.ok) {
        const error = new Error((data && data.error) || `http ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');
      throw error.name === 'AbortError' ? new Error('timeout') : error;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', relay);
    }
  }

  function request({ provider, query, category, page }, signal) {
    const params = new URLSearchParams({ provider, q: query, page: String(page) });
    if (category) params.set('category', category);
    return api(`/api/music/search?${params}`, { signal, auth: Boolean(providerInfo(provider).personal) });
  }

  /* ── Разметка библиотеки ── */

  function build() {
    if (built) return;
    built = true;
    els.input = h('input', { type: 'search', class: 'mlib-input', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', maxlength: '100' });
    els.clear = h('button', { type: 'button', class: 'mlib-clear', hidden: true }, icon('close'));
    els.tabs = h('div', { class: 'mlib-tabs', role: 'tablist' });
    els.cats = h('div', { class: 'mlib-cats', hidden: true });
    els.extra = h('div', { class: 'mlib-extra', hidden: true });
    els.list = h('div', { class: 'mlib-list', role: 'list' });
    els.scroll = h('div', { class: 'mlib-scroll' }, els.extra, els.list);

    els.pCover = h('span', { class: 'mlib-cover mlib-cover--sm' });
    els.pTitle = h('b');
    els.pArtist = h('span');
    els.pTake = h('button', { type: 'button', class: 'btn btn--gold mlib-take' });
    els.pNow = h('span', { class: 'mlib-time' }, '00:00');
    els.pTotal = h('span', { class: 'mlib-time' }, '00:00');
    els.pLine = h('div', { class: 'mlib-line', role: 'slider', tabindex: '0', 'aria-valuemin': '0' }, h('span', { class: 'mlib-line-fill' }), h('i', {}));
    els.pPrev = h('button', { type: 'button', class: 'mlib-ctl' }, icon('prev', true));
    els.pToggle = h('button', { type: 'button', class: 'mlib-ctl mlib-ctl--main' }, icon('play', true), icon('pause'));
    els.pNext = h('button', { type: 'button', class: 'mlib-ctl' }, icon('next', true));
    els.player = h('div', { class: 'mlib-player', hidden: true },
      h('div', { class: 'mlib-player-top' }, els.pCover, h('div', { class: 'mlib-player-info' }, els.pTitle, els.pArtist), els.pTake),
      h('div', { class: 'mlib-seek' }, els.pNow, els.pLine, els.pTotal),
      h('div', { class: 'mlib-controls' }, els.pPrev, els.pToggle, els.pNext));

    els.library = h('div', { class: 'mlib-view mlib-view--library' },
      h('label', { class: 'mlib-search' }, icon('search'), els.input, els.clear),
      els.tabs, els.cats, els.scroll, els.player);

    els.title = h('h2', { class: 'mlib-title', id: 'mlib-title' });
    els.back = h('button', { type: 'button', class: 'mlib-icon', hidden: true }, icon('back'));
    els.close = h('button', { type: 'button', class: 'mlib-icon' }, icon('close'));
    els.sheet = h('section', { class: 'mlib-sheet', tabindex: '-1' },
      h('span', { class: 'mlib-grip', 'aria-hidden': 'true' }),
      h('header', { class: 'mlib-head' }, els.back, els.title, els.close),
      els.library, start.el);
    els.backdrop = h('div', { class: 'mlib-backdrop' });
    els.modal = h('div', { class: 'mlib', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mlib-title', hidden: true }, els.backdrop, els.sheet);
    document.body.appendChild(els.modal);

    els.backdrop.addEventListener('click', close);
    els.close.addEventListener('click', close);
    els.back.addEventListener('click', backToLibrary);
    els.input.addEventListener('input', () => {
      store.dispatch({ type: 'query', query: els.input.value });
      els.clear.hidden = !els.input.value;
      search.schedule();
    });
    els.input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      search.now();
      els.input.blur();
    });
    els.clear.addEventListener('click', () => {
      els.input.value = '';
      els.clear.hidden = true;
      store.dispatch({ type: 'query', query: '' });
      search.now();
    });
    els.pToggle.addEventListener('click', () => {
      haptic.tap();
      if (Player.isPlaying()) Player.pause(); else Player.play();
    });
    els.pPrev.addEventListener('click', () => step(-1));
    els.pNext.addEventListener('click', () => step(1));
    els.pTake.addEventListener('click', () => { const current = Player.current(); if (current) choose(current); });
    wireSeek();
  }

  /* ── Отрисовка ── */

  function renderTexts() {
    els.input.placeholder = w('searchPh');
    els.input.setAttribute('aria-label', w('searchPh'));
    els.clear.setAttribute('aria-label', w('clear'));
    els.close.setAttribute('aria-label', w('close'));
    els.back.setAttribute('aria-label', w('back'));
    els.pTake.textContent = w('take');
    els.pPrev.setAttribute('aria-label', w('prev'));
    els.pNext.setAttribute('aria-label', w('next'));
    els.pLine.setAttribute('aria-label', w('seek'));
  }

  function renderTabs() {
    const s = store.get();
    els.tabs.replaceChildren(...providers().map((p) => {
      const on = p.id === s.provider;
      const tab = h('button', { type: 'button', role: 'tab', class: `mlib-tab${on ? ' is-on' : ''}`, 'aria-selected': on ? 'true' : 'false' },
        w('providers')[p.id] || p.label || p.id);
      tab.addEventListener('click', () => setProvider(p.id));
      return tab;
    }));
  }

  function renderCats() {
    const s = store.get();
    els.cats.hidden = !providerInfo(s.provider).categories;
    if (els.cats.hidden) return;
    const chip = (id, label) => {
      const on = s.category === id;
      const button = h('button', { type: 'button', class: `mlib-chip${on ? ' is-on' : ''}`, 'aria-pressed': on ? 'true' : 'false' }, label);
      button.addEventListener('click', () => setCategory(id));
      return button;
    };
    els.cats.replaceChildren(chip('', w('allCats')), ...categories().map((id) => chip(id, w('categories')[id] || id)));
  }

  function renderExtra() {
    const personal = Boolean(providerInfo(store.get().provider).personal);
    els.extra.hidden = !personal;
    if (!personal) { els.extra.replaceChildren(); return; }
    const botUrl = options.botUrl();
    const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.ogg,.wav', hidden: true });
    els.upload = h('button', { type: 'button', class: 'btn btn--ghost mlib-upload' }, icon('upload'), h('span', {}, w('upload')));
    els.upload.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { uploadFile(file.files[0]); file.value = ''; });
    const open = botUrl ? h('button', { type: 'button', class: 'btn btn--gold mlib-bot-open' }, w('botOpen')) : null;
    if (open) open.addEventListener('click', () => openBot(botUrl));
    els.extra.replaceChildren(
      h('div', { class: 'mlib-bot' },
        h('span', { class: 'mlib-bot-ic' }, icon('send')),
        h('div', { class: 'mlib-bot-copy' }, h('b', {}, w('botTitle')), h('span', {}, w('botText')))),
      h('div', { class: 'mlib-extra-acts' }, open, els.upload, file));
  }

  function stateBlock(kind) {
    const s = store.get();
    const titles = {
      error: ['errorTitle', 'errorText'], empty: ['emptyTitle', 'emptyText'], shelf: ['shelfEmptyTitle', 'shelfEmptyText'],
      youtube: ['ytPromptTitle', 'ytPromptText'], mine: ['mineEmptyTitle', 'mineEmptyText'],
    }[kind];
    const block = h('div', { class: `mlib-state mlib-state--${kind}` },
      h('span', { class: 'mlib-state-ic' }, icon(kind === 'error' ? 'retry' : kind === 'youtube' ? 'search' : 'note')),
      h('b', {}, w(titles[0])), h('span', {}, w(titles[1])));
    if (kind === 'error') {
      const retry = h('button', { type: 'button', class: 'btn btn--ghost mlib-retry' }, w('retry'));
      retry.addEventListener('click', () => { haptic.tap(); search.retry(); });
      block.appendChild(retry);
    }
    if (s.search.status === 'ready' && kind === 'empty') block.classList.add('is-soft');
    return block;
  }

  function renderList(fresh = false) {
    const s = store.get();
    const { status, items, next, more } = s.search;
    const keep = fresh ? 0 : els.scroll.scrollTop;
    const nodes = [];
    if (status === 'loading' && !more) {
      for (let i = 0; i < 6; i += 1) {
        nodes.push(h('div', { class: 'mrow mrow--ghost', 'aria-hidden': 'true' },
          h('span', { class: 'mlib-cover' }), h('span', { class: 'mrow-info' }, h('b', {}), h('span', {}))));
      }
    } else if (status === 'error') {
      nodes.push(stateBlock('error'));
    } else if (status === 'idle') {
      if (s.provider === 'youtube') nodes.push(stateBlock('youtube'));
    } else if (!items.length) {
      const personal = providerInfo(s.provider).personal;
      nodes.push(stateBlock(personal ? 'mine' : s.query.trim().length >= Core.MIN_QUERY ? 'empty' : 'shelf'));
    } else {
      items.forEach((track) => nodes.push(row(track)));
      if (next !== null || more) {
        const button = h('button', { type: 'button', class: `btn btn--ghost btn--block mlib-more${more ? ' btn--wait' : ''}` }, w('more'));
        button.disabled = more;
        button.addEventListener('click', () => { haptic.tap(); search.more(); });
        nodes.push(button);
      }
    }
    els.list.replaceChildren(...nodes);
    els.list.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
    els.scroll.scrollTop = keep;
  }

  function row(track) {
    const key = Core.trackKey(track);
    const main = h('button', { type: 'button', class: 'mrow-main' },
      h('span', { class: 'mlib-cover' }, ...cover(track)),
      h('span', { class: 'mrow-info' }, h('b', {}, track.title), h('span', {}, track.artist || w('providers')[track.provider])),
      h('span', { class: 'mrow-time' }, track.duration ? Core.clock(track.duration) : ''));
    const listen = h('button', { type: 'button', class: 'mrow-listen' }, icon('play', true), icon('pause'), h('span', { class: 'mrow-listen-txt' }));
    const take = h('button', { type: 'button', class: 'mrow-take' }, w('take'));
    main.addEventListener('click', () => listenTo(track));
    listen.addEventListener('click', () => listenTo(track));
    take.addEventListener('click', () => choose(track));
    const el = h('div', { class: 'mrow', role: 'listitem', dataset: { key } }, main, h('span', { class: 'mrow-acts' }, listen, take));
    paintRow(el, track);
    el.track = track;
    return el;
  }

  function paintRow(el, track) {
    const s = store.get();
    const status = s.preview.key === el.dataset.key ? s.preview.status : 'idle';
    el.classList.toggle('is-active', status !== 'idle');
    el.classList.toggle('is-playing', status === 'playing');
    el.classList.toggle('is-loading', status === 'loading');
    el.classList.toggle('is-error', status === 'error');
    const chosen = Boolean(s.saved) && `${s.saved.provider}:${s.saved.trackId}` === el.dataset.key;
    el.classList.toggle('is-chosen', chosen);
    const label = status === 'playing' ? w('pause') : w('listen');
    el.querySelector('.mrow-listen-txt').textContent = label;
    el.querySelector('.mrow-listen').setAttribute('aria-label', `${label}: ${track.title}`);
    el.querySelector('.mrow-main').setAttribute('aria-label', `${label}: ${track.title}`);
    el.querySelector('.mrow-take').setAttribute('aria-label', `${w('take')}: ${track.title}`);
  }

  function updateRows() {
    for (const el of els.list.querySelectorAll('.mrow[data-key]')) if (el.track) paintRow(el, el.track);
  }

  function renderPlayerBar() {
    const s = store.get();
    const current = Player.current();
    const show = owner === 'library' && Boolean(s.preview.key) && current && Core.trackKey(current) === s.preview.key;
    els.player.hidden = !show;
    els.sheet.classList.toggle('has-player', show);
    if (!show) return;
    if (els.player.dataset.key !== s.preview.key) {
      els.player.dataset.key = s.preview.key;
      els.pCover.replaceChildren(...cover(current));
      els.pTitle.textContent = current.title;
      els.pArtist.textContent = current.artist || w('providers')[current.provider];
    }
    const playing = s.preview.status === 'playing';
    els.player.classList.toggle('is-playing', playing);
    els.player.classList.toggle('is-loading', s.preview.status === 'loading');
    els.pToggle.setAttribute('aria-label', playing ? w('pause') : w('listen'));
    const index = s.search.items.findIndex((t) => Core.trackKey(t) === s.preview.key);
    els.pPrev.disabled = index <= 0;
    els.pNext.disabled = index < 0 || index >= s.search.items.length - 1;
    paintTime();
  }

  function renderView() {
    const onStart = store.get().view === 'start';
    els.library.hidden = onStart;
    start.el.hidden = !onStart;
    els.back.hidden = !onStart;
    els.title.textContent = onStart ? w('startTitle') : w('title');
    els.sheet.classList.toggle('is-start', onStart);
    if (onStart) start.render();
  }

  function renderOpen(s) {
    clearTimeout(hideTimer);
    if (s.open) {
      els.modal.hidden = false;
      document.documentElement.classList.add('mlib-lock');
      // Чтение размера фиксирует закрытое положение — переход сработает без ожидания кадров.
      void els.sheet.offsetHeight;
      els.modal.classList.add('is-open');
      els.sheet.focus({ preventScroll: true });
    } else {
      els.modal.classList.remove('is-open');
      document.documentElement.classList.remove('mlib-lock');
      hideTimer = setTimeout(() => { if (!store.get().open) els.modal.hidden = true; }, 420);
    }
  }

  /* ── Время и перемотка ── */

  function paintTime() {
    if (owner === 'library' && !els.player.hidden && !seeking) {
      const at = Player.time();
      const total = Player.duration() || Player.current()?.duration || 0;
      els.player.style.setProperty('--p', total > 0 ? Math.min(1, at / total).toFixed(4) : '0');
      els.pNow.textContent = Core.clock(at);
      els.pTotal.textContent = total ? Core.clock(total) : '--:--';
      els.pLine.setAttribute('aria-valuenow', String(Math.round(at)));
      els.pLine.setAttribute('aria-valuemax', String(Math.round(total)));
      els.pLine.setAttribute('aria-valuetext', Core.clock(at));
    }
    if (owner === 'start') start.paintTime();
  }

  function runClock() {
    cancelAnimationFrame(raf);
    const frame = () => {
      paintTime();
      raf = Player.isPlaying() ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
  }

  function stopClock() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function wireSeek() {
    const total = () => Player.duration() || Player.current()?.duration || 0;
    const at = (clientX) => {
      const rect = els.pLine.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))) * total();
    };
    const show = (time) => {
      const all = total();
      els.player.style.setProperty('--p', all ? Math.min(1, time / all).toFixed(4) : '0');
      els.pNow.textContent = Core.clock(time);
    };
    els.pLine.addEventListener('pointerdown', (event) => {
      if (!total()) return;
      event.preventDefault();
      try { els.pLine.setPointerCapture(event.pointerId); } catch (_) { /* — */ }
      seeking = true;
      show(at(event.clientX));
      const move = (e) => show(at(e.clientX));
      const up = (e) => {
        els.pLine.removeEventListener('pointermove', move);
        els.pLine.removeEventListener('pointerup', up);
        els.pLine.removeEventListener('pointercancel', up);
        seeking = false;
        if (e.type === 'pointerup') Player.seek(at(e.clientX));
        paintTime();
      };
      els.pLine.addEventListener('pointermove', move);
      els.pLine.addEventListener('pointerup', up);
      els.pLine.addEventListener('pointercancel', up);
    });
    els.pLine.addEventListener('keydown', (event) => {
      const steps = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5 };
      if (!(event.key in steps) || !total()) return;
      event.preventDefault();
      Player.seek(Math.min(total(), Math.max(0, Player.time() + steps[event.key])));
      paintTime();
    });
  }

  /* ── Действия ── */

  function listenTo(track) {
    haptic.tap();
    const key = Core.trackKey(track);
    const s = store.get();
    if (owner === 'library' && s.preview.key === key) {
      if (s.preview.status === 'playing') { Player.pause(); return; }
      if (s.preview.status === 'paused') { Player.play(); return; }
      if (s.preview.status === 'loading') return;
    }
    owner = 'library';
    store.dispatch({ type: 'preview:load', key });
    Player.load(track, { at: 0, autoplay: true });
  }

  function step(delta) {
    const s = store.get();
    const index = s.search.items.findIndex((t) => Core.trackKey(t) === s.preview.key);
    const target = s.search.items[index + delta];
    if (index >= 0 && target) listenTo(target);
  }

  function choose(track) {
    haptic.tap();
    const s = store.get();
    const same = s.saved && s.saved.provider === track.provider && s.saved.trackId === track.id;
    if (owner) Player.stop();
    owner = null;
    store.dispatch({ type: 'select', track, startAt: same ? s.saved.startAt : 0 });
    start.prepare(track);
  }

  function backToLibrary() {
    haptic.tap();
    if (owner === 'start') Player.stop();
    owner = null;
    start.abort();
    store.dispatch({ type: 'back' });
  }

  function setProvider(id) {
    if (id === store.get().provider) return;
    haptic.tap();
    if (owner === 'library') Player.stop();
    owner = null;
    store.dispatch({ type: 'provider', provider: id });
    mineSeen = null;
    search.now();
    if (id === 'youtube') Player.warmYouTube();
    syncPoll();
  }

  function setCategory(id) {
    haptic.tap();
    store.dispatch({ type: 'category', category: id });
    search.now();
  }

  function teardown() {
    if (owner) Player.stop();
    owner = null;
    Player.destroyYouTube();
    search.cancel();
    start.abort();
    stopClock();
    syncPoll(false);
  }

  function open() {
    build();
    haptic.tap();
    const s = store.get();
    teardown();
    store.dispatch({ type: 'open', provider: s.saved ? s.saved.provider : s.provider });
    els.input.value = store.get().query;
    els.clear.hidden = !els.input.value;
    renderTexts();
    renderTabs();
    renderCats();
    renderExtra();
    renderList(true);
    renderPlayerBar();
    renderView();
    search.now();
    if (store.get().provider === 'youtube') Player.warmYouTube();
    syncPoll();
  }

  function close() {
    if (!store || !store.get().open) return;
    teardown();
    store.dispatch({ type: 'close' });
  }

  function save() {
    const s = store.get();
    const draft = s.draft;
    if (!draft || !draft.ready || s.saving) return;
    const selection = Core.toSelection(draft.track, draft.startAt);
    if (!selection || !selection.duration || selection.startAt >= selection.duration) {
      toast(w('trackError'), 'err');
      return;
    }
    store.dispatch({ type: 'save:start' });
    haptic.ok();
    teardown();
    options.onSave(selection);
    store.dispatch({ type: 'save:done', selection });
  }

  function openBot(url) {
    haptic.tap();
    try {
      if (tg && tg.openTelegramLink) { tg.openTelegramLink(url); return; }
    } catch (_) { /* старый клиент — откроем вкладкой */ }
    window.open(url, '_blank', 'noopener');
  }

  async function uploadFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast(w('uploadBig'), 'err'); return; }
    const button = els.upload;
    button.disabled = true;
    button.classList.add('btn--wait');
    const local = URL.createObjectURL(file);
    try {
      const duration = await probeDuration(local);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-init-data': options.initData(),
          'x-file-name': encodeURIComponent(file.name.slice(0, 160)),
          'x-duration': duration > 0 ? String(Math.round(duration * 100) / 100) : '',
        },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 400 || (data.ok && data.kind !== 'audio')) { toast(w('uploadFormat'), 'err'); return; }
      if (!response.ok || !data.ok) throw new Error('upload');
      if (mineSeen && data.track) mineSeen.add(data.track.id);
      search.retry();
    } catch (_) {
      toast(w('uploadFail'), 'err');
    } finally {
      URL.revokeObjectURL(local);
      button.disabled = false;
      button.classList.remove('btn--wait');
    }
  }

  /* Песня, пересланная боту, появляется сама: пока открыта своя музыка, студия
     переспрашивает сервер. */
  function syncPoll(want) {
    const s = store.get();
    const on = want !== false && s.open && s.view === 'library' && providerInfo(s.provider).personal && !document.hidden;
    if (on && !poll) poll = setInterval(() => search.refresh(), 5000);
    if (!on && poll) { clearInterval(poll); poll = 0; }
  }

  function noticeMine(s) {
    const ids = s.search.items.map((t) => t.id);
    if (mineSeen) {
      const fresh = s.search.items.find((t) => !mineSeen.has(t.id));
      if (fresh) toast(w('mineFresh', fresh.title), 'ok');
    }
    mineSeen = new Set(ids);
  }

  /* ── Карточка в шаге студии ── */

  function renderCard() {
    const root = options.root;
    if (!root) return;
    const sel = store.get().saved;
    els.cardPlay = null;
    if (!sel) {
      const pick = h('button', { type: 'button', class: 'btn btn--gold btn--block mcard-pick' }, w('pick'));
      const skip = h('button', { type: 'button', class: 'linkbtn mcard-skip' }, w('skip'));
      pick.addEventListener('click', open);
      skip.addEventListener('click', () => { haptic.tap(); options.onSkip(); });
      root.replaceChildren(
        h('div', { class: 'mcard mcard--empty' },
          h('span', { class: 'mcard-cover' }, icon('note')),
          h('div', { class: 'mcard-info' }, h('b', {}, w('noneTitle')), h('span', {}, w('noneText')))),
        pick, skip);
      return;
    }
    const track = Core.trackFromSelection(sel);
    els.cardPlay = h('button', { type: 'button', class: 'mcard-play' }, icon('play', true), icon('pause'));
    const change = h('button', { type: 'button', class: 'btn btn--ghost btn--tiny mcard-change' }, w('change'));
    const remove = h('button', { type: 'button', class: 'linkbtn mcard-skip' }, w('remove'));
    els.cardPlay.addEventListener('click', toggleCard);
    change.addEventListener('click', open);
    remove.addEventListener('click', () => {
      haptic.tap();
      if (owner === 'card') Player.stop();
      owner = null;
      options.onSkip();
    });
    root.replaceChildren(
      h('div', { class: 'mcard' },
        h('span', { class: 'mcard-cover' }, ...cover(track)),
        h('div', { class: 'mcard-info' },
          h('b', {}, sel.title),
          h('span', {}, sel.artist || w('providers')[sel.provider]),
          h('em', {}, sel.startAt > 0 ? w('startsAt', Core.clock(sel.startAt)) : w('fromStart'))),
        h('div', { class: 'mcard-acts' }, els.cardPlay, change)),
      remove);
    paintCardPlay(owner === 'card' && Player.isPlaying() ? 'playing' : 'idle');
  }

  function paintCardPlay(state) {
    if (!els.cardPlay) return;
    els.cardPlay.classList.toggle('is-playing', state === 'playing');
    els.cardPlay.classList.toggle('is-loading', state === 'loading');
    els.cardPlay.setAttribute('aria-label', state === 'playing' ? w('pause') : w('listen'));
  }

  function toggleCard() {
    const sel = store.get().saved;
    if (!sel) return;
    haptic.tap();
    const track = Core.trackFromSelection(sel);
    const current = Player.current();
    if (owner === 'card' && current && Core.trackKey(current) === Core.trackKey(track)) {
      if (Player.isPlaying()) Player.pause(); else Player.play();
      return;
    }
    if (owner) Player.stop();
    owner = 'card';
    Player.load(track, { at: sel.startAt, autoplay: true });
  }

  /* ── Связки ── */

  function onState(s, prev) {
    if (built) {
      if (s.open !== prev.open) renderOpen(s);
      if (s.provider !== prev.provider || s.category !== prev.category) { renderTabs(); renderCats(); renderExtra(); }
      if (s.search !== prev.search) {
        renderList(s.search.key !== prev.search.key);
        if (s.search.status === 'ready' && providerInfo(s.provider).personal) noticeMine(s);
      } else if (s.preview !== prev.preview || s.saved !== prev.saved) {
        updateRows();
      }
      if (s.preview !== prev.preview || s.search.items !== prev.search.items) renderPlayerBar();
      if (s.view !== prev.view) { renderView(); syncPoll(); }
      if (s.draft !== prev.draft || s.saving !== prev.saving) start.render();
      els.modal.dataset.phase = s.phase;
    }
    if (s.saved !== prev.saved) renderCard();
  }

  function onPlayer(type, detail) {
    const key = Core.trackKey(detail.track);
    if (owner === 'library') {
      if (type === 'playing') store.dispatch({ type: 'preview:playing', key });
      else if (type === 'paused' || type === 'ended') store.dispatch({ type: 'preview:paused', key });
      else if (type === 'error') { store.dispatch({ type: 'preview:error', key, error: detail.code }); toast(w('trackError'), 'err'); }
      else if (type === 'stopped') store.dispatch({ type: 'preview:stop' });
    } else if (owner === 'start') {
      // «duration» и подгрузка посреди песни состояние кнопки не меняют.
      if (type === 'error') toast(w('trackError'), 'err');
      if (type === 'playing') start.paintPlay(true);
      else if (['paused', 'ended', 'error'].includes(type)) start.paintPlay(false);
    } else if (owner === 'card') {
      if (type === 'error') toast(w('trackError'), 'err');
      if (type === 'playing') paintCardPlay('playing');
      else if (type === 'loading' && !Player.isPlaying()) paintCardPlay('loading');
      else if (['paused', 'ended', 'error'].includes(type)) paintCardPlay('idle');
    }
    if (type === 'stopped') { start.paintPlay(false); paintCardPlay('idle'); }
    if (type === 'playing') runClock();
    else if (['paused', 'ended', 'stopped', 'error'].includes(type)) { stopClock(); paintTime(); }
  }

  function render() {
    renderCard();
    if (!built) return;
    renderTexts();
    renderTabs();
    renderCats();
    renderExtra();
    renderList(false);
    renderPlayerBar();
    renderView();
    start.render();
  }

  function mount(opts) {
    options = opts;
    store = Core.createStore(Core.initialState(opts.selection()));
    search = Core.createSearch({
      store,
      request,
      browses: (id) => Boolean(providerInfo(id).browse),
      personal: (id) => Boolean(providerInfo(id).personal),
      delay: 350,
    });
    start = NvMusicStart.create({
      store, Core, Player, h, w, icon, cover, haptic, toast, api,
      getOwner: () => owner,
      setOwner: (next) => { owner = next; },
      back: backToLibrary,
      save,
    });
    store.subscribe(onState);
    Player.subscribe(onPlayer);
    Player.onBlocked((hint) => { if (hint) hint.textContent = w('tapVideo'); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && store.get().open) { event.preventDefault(); close(); }
    });
    document.addEventListener('visibilitychange', () => syncPoll());
    window.addEventListener('pagehide', () => { search.cancel(); Player.destroy(); });
    renderCard();
    return {
      render,
      open,
      close,
      isOpen: () => store.get().open,
      hush() {
        if (owner) Player.stop();
        owner = null;
      },
      setSelection(selection) { store.dispatch({ type: 'saved', selection }); },
      phase: () => store.get().phase,
    };
  }

  window.NvMusic = Object.freeze({ mount });
})();
