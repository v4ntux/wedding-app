/* global NvMusicCore, NvMusicPlayer, NvMusicStart */
/* nvate studio — музыка.

   Шаг «Musiqa» прямо в форме, без окон. Сверху — выбранная песня, под ней два
   источника. YouTube — поиск: послушал несколько вариантов → «Tanlash».
   «Mening musiqam» — всё своё: magic import по ссылке (YouTube, TikTok,
   Instagram…), загрузка звука или видео и песни, пересланные боту. Выбрал,
   загрузил или импортировал — открывается «катушка»: точный момент начала
   (music-start.js), и только потом «Saqlash».

   Звучит всегда что-то одно — единый плеер (music-player.js). Состояние шага
   одно — в music-core.js. */
(function () {
  'use strict';

  const Core = window.NvMusicCore;
  const { Player, probeDuration } = window.NvMusicPlayer;
  const { h, toast, haptic, tg } = window.UI;

  const POLL_MS = 1500;
  const MAX_MEDIA_BYTES = 60 * 1024 * 1024;
  const VIDEO_NAME = /\.(?:mp4|mov|m4v|webm|mkv|avi|3gp)$/i;
  const SITES = ['YouTube', 'TikTok', 'Instagram', 'Facebook', 'VK'];

  const WORDS = {
    uz: {
      providers: { youtube: 'YouTube', upload: 'Mening musiqam', nvate: 'nVate', audius: 'Audius' },
      searchPh: 'Qo‘shiq yoki ijrochi nomi…', clear: 'Tozalash',
      listen: 'Tinglash', pause: 'Pauza', take: 'Tanlash', more: 'Yana ko‘rsatish', retry: 'Qayta urinish',
      emptyTitle: 'Hech narsa topilmadi', emptyText: 'Boshqa so‘z bilan qidirib ko‘ring',
      ytPromptTitle: 'YouTube’dan qidiring', ytPromptText: 'Qo‘shiq yoki ijrochi nomini yozing — tinglab, keyin tanlaysiz',
      mineEmptyTitle: 'Hozircha qo‘shiq yo‘q', mineEmptyText: 'Havolani qo‘ying, fayl yuklang yoki qo‘shiqni botga yuboring',
      errorTitle: 'Qo‘shiqlar ochilmadi', errorText: 'Aloqani tekshirib, qayta urinib ko‘ring',
      trackError: 'Bu qo‘shiqni ochib bo‘lmadi — boshqasini tanlang', tapVideo: 'Tinglash uchun videoga bosing',
      startLabel: 'Boshlanish', startHint: 'Tasmani suring: igna ostidan mehmonlar eshitadi', playFrom: 'Shu yerdan tinglash',
      back: 'Orqaga', save: 'Saqlash', saving: 'Saqlanmoqda…', top: 'Top tanlov', startSlider: 'Boshlanish vaqti',
      nudge: (d) => `${Math.abs(d)} soniya ${d < 0 ? 'oldinroq' : 'keyinroq'}`, waveCooking: 'To‘lqin tayyorlanmoqda',
      startsAt: (time) => `${time} dan boshlanadi`, fromStart: 'Boshidan boshlanadi',
      chosen: 'Tanlangan qo‘shiq', changeStart: 'O‘zgartirish', remove: 'Musiqani olib tashlash',
      skip: 'Musiqasiz davom etish',
      magicTitle: 'Magic import', magicText: 'YouTube, TikTok, Instagram yoki boshqa havola — musiqasini o‘zimiz ajratib olamiz',
      linkPh: 'Havolani shu yerga qo‘ying', paste: 'Qo‘yish', importGo: 'Import', importOff: 'Import vaqtincha ishlamayapti',
      uploadTitle: 'Audio yoki video', uploadText: 'Fayl yuklash · 60 MB gacha',
      botTitle: 'Botga yuborish', botText: 'Qo‘shiq, video yoki havola',
      stages: { uploading: 'Yuklanmoqda', queued: 'Navbatda', fetching: 'Havola o‘qilmoqda', converting: 'Musiqa ajratilmoqda', saving: 'Saqlanmoqda', done: 'Tayyor' },
      importDone: (name) => `«${name}» tayyor`, mineFresh: (name) => `«${name}» botdan keldi`, dismiss: 'Yopish',
      errors: {
        link: 'Havolani o‘qib bo‘lmadi', unsupported: 'Bu saytdan musiqa olib bo‘lmaydi',
        blocked: 'YouTube hozir ruxsat bermadi — keyinroq urinib ko‘ring', private: 'Video yopiq yoki kirishni talab qiladi',
        long: 'Video 15 daqiqadan uzun', big: 'Fayl juda katta — 60 MB gacha', gone: 'Video topilmadi',
        noaudio: 'Bu videoda ovoz yo‘q', format: 'Bu faylni o‘qiy olmadik', timeout: 'Juda uzoq davom etdi — qayta urinib ko‘ring',
        busy: 'Hozir navbat katta — birozdan keyin', unavailable: 'Import vaqtincha ishlamayapti', auth: 'Studiyani bot orqali oching',
        failed: 'Musiqani ajratib bo‘lmadi',
      },
    },
    ru: {
      providers: { youtube: 'YouTube', upload: 'Моя музыка', nvate: 'nVate', audius: 'Audius' },
      searchPh: 'Песня или исполнитель…', clear: 'Очистить',
      listen: 'Слушать', pause: 'Пауза', take: 'Выбрать', more: 'Показать ещё', retry: 'Повторить',
      emptyTitle: 'Ничего не нашлось', emptyText: 'Попробуйте другие слова',
      ytPromptTitle: 'Поиск по YouTube', ytPromptText: 'Впишите песню или исполнителя — сначала послушаете, потом выберете',
      mineEmptyTitle: 'Пока пусто', mineEmptyText: 'Вставьте ссылку, загрузите файл или пришлите песню боту',
      errorTitle: 'Не удалось загрузить песни', errorText: 'Проверьте связь и попробуйте ещё раз',
      trackError: 'Эту песню не удалось открыть — выберите другую', tapVideo: 'Нажмите на видео, чтобы послушать',
      startLabel: 'Начало', startHint: 'Тяните ленту: с иглы гости и услышат', playFrom: 'Слушать отсюда',
      back: 'Назад', save: 'Сохранить', saving: 'Сохраняем…', top: 'Топ выбор', startSlider: 'Начало песни',
      nudge: (d) => `На ${Math.abs(d)} с ${d < 0 ? 'раньше' : 'позже'}`, waveCooking: 'Готовим волну',
      startsAt: (time) => `Начинается с ${time}`, fromStart: 'Играет с начала',
      chosen: 'Выбранная песня', changeStart: 'Изменить', remove: 'Убрать музыку',
      skip: 'Продолжить без музыки',
      magicTitle: 'Magic import', magicText: 'Ссылка на YouTube, TikTok, Instagram или другой сайт — музыку достанем сами',
      linkPh: 'Вставьте ссылку', paste: 'Вставить', importGo: 'Импорт', importOff: 'Импорт временно недоступен',
      uploadTitle: 'Аудио или видео', uploadText: 'Загрузить файл · до 60 МБ',
      botTitle: 'Прислать боту', botText: 'Песню, видео или ссылку',
      stages: { uploading: 'Загружаем', queued: 'В очереди', fetching: 'Читаем ссылку', converting: 'Достаём музыку', saving: 'Сохраняем', done: 'Готово' },
      importDone: (name) => `«${name}» готова`, mineFresh: (name) => `«${name}» пришла из бота`, dismiss: 'Закрыть',
      errors: {
        link: 'Не получилось прочитать ссылку', unsupported: 'С этого сайта звук не достать',
        blocked: 'YouTube сейчас не отдаёт звук — попробуйте позже', private: 'Видео закрыто или требует входа',
        long: 'Видео длиннее 15 минут', big: 'Файл слишком большой — до 60 МБ', gone: 'Видео не найдено',
        noaudio: 'В этом видео нет звука', format: 'Не получилось прочитать файл', timeout: 'Слишком долго — попробуйте ещё раз',
        busy: 'Сейчас очередь — попробуйте чуть позже', unavailable: 'Импорт временно недоступен', auth: 'Откройте студию через бота',
        failed: 'Не удалось достать музыку',
      },
    },
  };

  const PATHS = {
    play: ['M8 5.5v13l10.5-6.5z'],
    pause: ['M9 6v12', 'M15 6v12'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    search: ['M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z', 'M15.5 15.5L20 20'],
    note: ['M9 18V6l10-2v12', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M16 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
    send: ['M21 4L3 11l6.5 2.5L12 20l3-5.5L21 4z', 'M9.5 13.5L21 4'],
    retry: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
    youtube: ['M3.4 8.2c.1-1.6 1.3-2.9 2.9-3C8.1 5 9.9 5 12 5s3.9 0 5.7.2c1.6.1 2.8 1.4 2.9 3 .1 1.2.1 2.5.1 3.8s0 2.6-.1 3.8c-.1 1.6-1.3 2.9-2.9 3-1.8.2-3.6.2-5.7.2s-3.9 0-5.7-.2c-1.6-.1-2.8-1.4-2.9-3-.1-1.2-.1-2.5-.1-3.8s0-2.6.1-3.8z', 'M10 9.1v5.8l5-2.9z'],
    link: ['M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1'],
    paste: ['M9 3.5h6v3H9z', 'M9 5H6.5A1.5 1.5 0 0 0 5 6.5v12A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 17.5 5H15'],
    spark: ['M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z', 'M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
    film: ['M4 5h16v14H4z', 'M8 5v14', 'M16 5v14', 'M4 9.5h4', 'M4 14.5h4', 'M16 9.5h4', 'M16 14.5h4'],
  };

  let options = null;
  let store = null;
  let search = null;
  let start = null;
  let owner = null;               // кто сейчас звучит: library | start | card
  let built = false;
  let raf = 0;
  let poll = 0;
  let mineSeen = null;
  let ytQuery = '';
  const els = {};
  const jobTimers = new Map();
  const jobFailures = new Map();
  const retries = new Map();      // id задачи → как запустить её заново
  const announced = new Set();

  const lang = () => (options && options.lang() === 'ru' ? 'ru' : 'uz');
  function w(key, ...args) {
    const value = WORDS[lang()][key] ?? WORDS.uz[key];
    return typeof value === 'function' ? value(...args) : value;
  }
  const importError = (code) => w('errors')[code] || w('errors').failed;
  const reducedMotion = () => Boolean(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

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

  const importInfo = () => options.config()?.import || { link: true, video: true };
  const personal = (id) => id === 'upload';

  /* Запрос к API с тайм-аутом: зависший источник не держит студию. */
  async function api(path, { signal, auth = false, timeout = 15000, method = 'GET', body } = {}) {
    const inner = new AbortController();
    const timer = setTimeout(() => inner.abort(), timeout);
    const relay = () => inner.abort();
    if (signal) signal.addEventListener('abort', relay, { once: true });
    try {
      const headers = {};
      if (auth) headers['x-init-data'] = options.initData();
      if (body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(path, {
        method, signal: inner.signal, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
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

  function request({ provider, query, page }, signal) {
    const params = new URLSearchParams({ provider, q: query, page: String(page) });
    return api(`/api/music/search?${params}`, { signal, auth: personal(provider) });
  }

  /* ── Разметка ── */

  function build() {
    if (built || !options.root) return;
    built = true;
    const root = options.root;
    root.classList.add('msec');

    els.chosen = h('div', { class: 'mchosen', hidden: true });

    els.segYt = h('button', { type: 'button', role: 'tab', class: 'mseg-btn' }, icon('youtube'), h('span', {}));
    els.segMine = h('button', { type: 'button', role: 'tab', class: 'mseg-btn' }, icon('note'), h('span', {}));
    els.seg = h('div', { class: 'mseg', role: 'tablist' }, h('span', { class: 'mseg-glide', 'aria-hidden': 'true' }), els.segYt, els.segMine);

    els.input = h('input', { type: 'search', class: 'mlib-input', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search', maxlength: '100' });
    els.clear = h('button', { type: 'button', class: 'mlib-clear', hidden: true }, icon('close'));
    els.ytList = h('div', { class: 'mlib-list', role: 'list' });
    els.panelYt = h('div', { class: 'mpanel', role: 'tabpanel' },
      h('label', { class: 'mlib-search' }, icon('search'), els.input, els.clear), els.ytList);

    els.link = h('input', { type: 'url', class: 'mmagic-input', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go', maxlength: '2000' });
    els.paste = h('button', { type: 'button', class: 'mmagic-paste' }, icon('paste'), h('span', {}));
    els.go = h('button', { type: 'submit', class: 'btn btn--gold mmagic-go' }, icon('spark'), h('span', {}));
    els.magicForm = h('form', { class: 'mmagic-form', novalidate: '' },
      h('label', { class: 'mmagic-field' }, icon('link'), els.link, els.paste), els.go);
    els.magicTitle = h('b', {});
    els.magicText = h('span', {});
    els.magicOff = h('p', { class: 'mmagic-off', hidden: true });
    els.magic = h('section', { class: 'mmagic' },
      h('div', { class: 'mmagic-head' },
        h('span', { class: 'mmagic-ic' }, icon('spark')),
        h('div', { class: 'mmagic-copy' }, els.magicTitle, els.magicText)),
      els.magicForm,
      h('div', { class: 'mmagic-sites', 'aria-hidden': 'true' }, ...SITES.map((name) => h('span', {}, name))),
      els.magicOff);

    els.file = h('input', { type: 'file', accept: 'audio/*,video/*,.mp3,.m4a,.ogg,.wav,.mp4,.mov,.webm,.mkv,.3gp', hidden: true });
    els.upload = h('button', { type: 'button', class: 'mtile' },
      h('span', { class: 'mtile-ic' }, icon('upload')), h('span', { class: 'mtile-copy' }, h('b', {}), h('span', {})));
    els.bot = h('button', { type: 'button', class: 'mtile' },
      h('span', { class: 'mtile-ic' }, icon('send')), h('span', { class: 'mtile-copy' }, h('b', {}), h('span', {})));
    els.jobs = h('div', { class: 'mjobs', 'aria-live': 'polite' });
    els.mineList = h('div', { class: 'mlib-list', role: 'list' });
    els.panelMine = h('div', { class: 'mpanel', role: 'tabpanel', hidden: true },
      els.magic, h('div', { class: 'mtiles' }, els.upload, els.bot, els.file), els.jobs, els.mineList);

    els.library = h('div', { class: 'mlib-inline' }, els.seg, els.panelYt, els.panelMine);
    els.skip = h('button', { type: 'button', class: 'linkbtn msec-skip', hidden: true });
    root.replaceChildren(els.chosen, els.library, start.el, els.skip);

    els.segYt.addEventListener('click', () => setProvider('youtube'));
    els.segMine.addEventListener('click', () => setProvider('upload'));
    els.input.addEventListener('input', () => {
      ensureOpen();
      ytQuery = els.input.value;
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
      ytQuery = '';
      els.clear.hidden = true;
      store.dispatch({ type: 'query', query: '' });
      search.now();
      els.input.focus();
    });
    els.magicForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitLink(els.link.value);
    });
    els.link.addEventListener('input', () => els.magicForm.classList.toggle('has-link', Boolean(els.link.value.trim())));
    els.link.addEventListener('paste', () => {
      // Вставили ссылку — импорт стартует сам, лишняя кнопка не нужна.
      setTimeout(() => { if (/https?:\/\//i.test(els.link.value)) submitLink(els.link.value); }, 0);
    });
    els.paste.addEventListener('click', pasteLink);
    els.paste.hidden = !(navigator.clipboard && navigator.clipboard.readText);
    els.upload.addEventListener('click', () => { haptic.tap(); els.file.click(); });
    els.file.addEventListener('change', () => { uploadMedia(els.file.files[0]); els.file.value = ''; });
    els.bot.addEventListener('click', openBot);
    els.skip.addEventListener('click', () => { haptic.tap(); options.onSkip(); });
  }

  /* ── Отрисовка ── */

  function renderTexts() {
    els.segYt.lastChild.textContent = w('providers').youtube;
    els.segMine.lastChild.textContent = w('providers').upload;
    els.input.placeholder = w('searchPh');
    els.input.setAttribute('aria-label', w('searchPh'));
    els.clear.setAttribute('aria-label', w('clear'));
    els.magicTitle.textContent = w('magicTitle');
    els.magicText.textContent = w('magicText');
    els.link.placeholder = w('linkPh');
    els.link.setAttribute('aria-label', w('linkPh'));
    els.paste.lastChild.textContent = w('paste');
    els.go.lastChild.textContent = w('importGo');
    els.upload.querySelector('b').textContent = w('uploadTitle');
    els.upload.querySelector('.mtile-copy span').textContent = w('uploadText');
    els.bot.querySelector('b').textContent = w('botTitle');
    els.bot.querySelector('.mtile-copy span').textContent = w('botText');
    els.bot.hidden = !options.botUrl();
    els.skip.textContent = w('skip');
    const tools = importInfo();
    els.magicOff.textContent = w('importOff');
    els.magicOff.hidden = tools.link !== false;
    els.magicForm.classList.toggle('is-off', tools.link === false);
  }

  function renderSeg() {
    const mine = store.get().provider === 'upload';
    els.seg.classList.toggle('is-mine', mine);
    els.segYt.classList.toggle('is-on', !mine);
    els.segMine.classList.toggle('is-on', mine);
    els.segYt.setAttribute('aria-selected', mine ? 'false' : 'true');
    els.segMine.setAttribute('aria-selected', mine ? 'true' : 'false');
    els.panelYt.hidden = mine;
    els.panelMine.hidden = !mine;
  }

  const listEl = () => (store.get().provider === 'upload' ? els.mineList : els.ytList);

  function stateBlock(kind) {
    const titles = {
      error: ['errorTitle', 'errorText'], empty: ['emptyTitle', 'emptyText'],
      youtube: ['ytPromptTitle', 'ytPromptText'], mine: ['mineEmptyTitle', 'mineEmptyText'],
    }[kind];
    const block = h('div', { class: `mlib-state mlib-state--${kind}` },
      h('span', { class: 'mlib-state-ic' }, icon(kind === 'error' ? 'retry' : kind === 'youtube' ? 'youtube' : 'note')),
      h('b', {}, w(titles[0])), h('span', {}, w(titles[1])));
    if (kind === 'error') {
      const retry = h('button', { type: 'button', class: 'btn btn--ghost mlib-retry' }, w('retry'));
      retry.addEventListener('click', () => { haptic.tap(); search.retry(); });
      block.appendChild(retry);
    }
    return block;
  }

  function renderList() {
    const s = store.get();
    const list = listEl();
    const { status, items, next, more } = s.search;
    const nodes = [];
    if (status === 'loading' && !more) {
      for (let i = 0; i < 4; i += 1) {
        nodes.push(h('div', { class: 'mrow mrow--ghost', 'aria-hidden': 'true' },
          h('span', { class: 'mlib-cover' }), h('span', { class: 'mrow-info' }, h('b', {}), h('span', {}))));
      }
    } else if (status === 'error') {
      nodes.push(stateBlock('error'));
    } else if (status === 'idle') {
      if (s.provider === 'youtube') nodes.push(stateBlock('youtube'));
    } else if (!items.length) {
      if (personal(s.provider)) {
        if (!s.imports.length) nodes.push(stateBlock('mine'));
      } else {
        nodes.push(stateBlock('empty'));
      }
    } else {
      items.forEach((track) => nodes.push(row(track)));
      if (next !== null || more) {
        const button = h('button', { type: 'button', class: `btn btn--ghost btn--block mlib-more${more ? ' btn--wait' : ''}` }, w('more'));
        button.disabled = more;
        button.addEventListener('click', () => { haptic.tap(); search.more(); });
        nodes.push(button);
      }
    }
    list.replaceChildren(...nodes);
    list.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
  }

  function row(track) {
    const key = Core.trackKey(track);
    const main = h('button', { type: 'button', class: 'mrow-main' },
      h('span', { class: 'mlib-cover' }, ...cover(track), h('span', { class: 'mrow-eq', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}))),
      h('span', { class: 'mrow-info' }, h('b', {}, track.title), h('span', {}, track.artist || w('providers')[track.provider])),
      h('span', { class: 'mrow-time' }, track.duration ? Core.clock(track.duration) : ''));
    const listen = h('button', { type: 'button', class: 'mrow-listen' }, icon('play', true), icon('pause'));
    const take = h('button', { type: 'button', class: 'mrow-take' }, w('take'));
    main.addEventListener('click', () => listenTo(track));
    listen.addEventListener('click', () => listenTo(track));
    take.addEventListener('click', () => choose(track));
    const el = h('div', { class: 'mrow', role: 'listitem', dataset: { key } },
      main, h('span', { class: 'mrow-acts' }, listen, take), h('span', { class: 'mrow-bar', 'aria-hidden': 'true' }));
    el.track = track;
    paintRow(el, track);
    return el;
  }

  function paintRow(el, track) {
    const s = store.get();
    const status = s.preview.key === el.dataset.key ? s.preview.status : 'idle';
    el.classList.toggle('is-active', status !== 'idle');
    el.classList.toggle('is-playing', status === 'playing');
    el.classList.toggle('is-loading', status === 'loading');
    el.classList.toggle('is-error', status === 'error');
    el.classList.toggle('is-chosen', Boolean(s.saved) && `${s.saved.provider}:${s.saved.trackId}` === el.dataset.key);
    if (status === 'idle') {
      el.style.removeProperty('--p');
      el.querySelector('.mrow-time').textContent = track.duration ? Core.clock(track.duration) : '';
    }
    const label = status === 'playing' ? w('pause') : w('listen');
    el.querySelector('.mrow-listen').setAttribute('aria-label', `${label}: ${track.title}`);
    el.querySelector('.mrow-main').setAttribute('aria-label', `${label}: ${track.title}`);
    el.querySelector('.mrow-take').setAttribute('aria-label', `${w('take')}: ${track.title}`);
  }

  function updateRows() {
    for (const list of [els.ytList, els.mineList]) {
      for (const el of list.querySelectorAll('.mrow[data-key]')) if (el.track) paintRow(el, el.track);
    }
  }

  /* Задачи импорта: волна-индикатор, стадия и прогресс, у ошибки — повтор. */
  function renderJobs() {
    const jobs = store.get().imports;
    els.jobs.replaceChildren(...jobs.map((job) => {
      const failed = job.status === 'error';
      const done = job.status === 'done';
      const stage = failed ? importError(job.error) : w('stages')[job.stage] || w('stages')[job.status] || '';
      const pct = job.progress !== null && !failed && !done && job.progress > 0 && job.progress < 1 ? ` · ${Math.round(job.progress * 100)}%` : '';
      const card = h('div', { class: `mjob is-${job.status}`, dataset: { id: job.id } },
        h('span', { class: 'mjob-ic' }, failed ? icon('close') : job.site === 'video' ? icon('film') : job.kind === 'file' ? icon('note') : icon('link'),
          h('span', { class: 'mjob-wave', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}), h('i', {}), h('i', {}))),
        h('div', { class: 'mjob-info' },
          h('b', {}, job.track?.title || job.label || w('magicTitle')),
          h('span', {}, `${stage}${pct}`)),
        h('span', { class: 'mjob-bar', 'aria-hidden': 'true' }));
      card.style.setProperty('--p', job.progress === null ? '0' : String(job.progress));
      card.classList.toggle('is-indeterminate', !failed && !done && (job.progress === null || job.progress <= 0));
      if (failed) {
        const acts = h('span', { class: 'mjob-acts' });
        const again = retries.get(job.id);
        if (again) {
          const retry = h('button', { type: 'button', class: 'mjob-btn', 'aria-label': w('retry') }, icon('retry'));
          retry.addEventListener('click', () => { haptic.tap(); store.dispatch({ type: 'import:remove', id: job.id }); retries.delete(job.id); again(); });
          acts.appendChild(retry);
        }
        const dismiss = h('button', { type: 'button', class: 'mjob-btn', 'aria-label': w('dismiss') }, icon('close'));
        dismiss.addEventListener('click', () => { haptic.tap(); retries.delete(job.id); store.dispatch({ type: 'import:remove', id: job.id }); });
        acts.appendChild(dismiss);
        card.appendChild(acts);
      }
      return card;
    }));
    els.jobs.hidden = !jobs.length;
  }

  /* Выбранная песня над источниками: послушать, поменять начало, убрать. */
  function renderChosen() {
    const s = store.get();
    const sel = s.saved;
    const onStart = s.view === 'start';
    els.chosen.hidden = !sel || onStart;
    els.skip.hidden = Boolean(sel) || onStart;
    els.cardPlay = null;
    if (!sel) {
      els.chosen.replaceChildren();
      return;
    }
    const track = Core.trackFromSelection(sel);
    els.cardPlay = h('button', { type: 'button', class: 'mchosen-play' }, icon('play', true), icon('pause'));
    const remove = h('button', { type: 'button', class: 'mchosen-remove', 'aria-label': w('remove') }, icon('close'));
    const edit = h('button', { type: 'button', class: 'mchosen-edit' },
      h('span', {}, sel.startAt > 0 ? w('startsAt', Core.clock(sel.startAt)) : w('fromStart')), h('b', {}, w('changeStart')));
    els.cardPlay.addEventListener('click', toggleCard);
    remove.addEventListener('click', () => {
      haptic.tap();
      if (owner === 'card') Player.stop();
      owner = null;
      options.onSkip();
    });
    edit.addEventListener('click', () => choose(track, sel.startAt));
    els.chosen.replaceChildren(
      h('span', { class: 'mchosen-label' }, w('chosen')),
      h('div', { class: 'mchosen-row' },
        h('span', { class: 'mlib-cover mchosen-cover' }, ...cover(track)),
        h('div', { class: 'mchosen-info' }, h('b', {}, sel.title), h('span', {}, sel.artist || w('providers')[sel.provider] || '')),
        els.cardPlay, remove),
      edit);
    paintCardPlay(owner === 'card' && Player.isPlaying() ? 'playing' : 'idle');
  }

  function paintCardPlay(state) {
    if (!els.cardPlay) return;
    els.cardPlay.classList.toggle('is-playing', state === 'playing');
    els.cardPlay.classList.toggle('is-loading', state === 'loading');
    els.cardPlay.setAttribute('aria-label', state === 'playing' ? w('pause') : w('listen'));
  }

  function renderView(scroll = false) {
    const onStart = store.get().view === 'start';
    els.library.hidden = onStart;
    start.el.hidden = !onStart;
    // Пока выбирают начало, плавающая «к следующему шагу» не ложится на «Saqlash».
    document.body.classList.toggle('is-music-reel', onStart);
    renderChosen();
    if (!onStart) return;
    start.render();
    start.show();
    if (scroll) {
      requestAnimationFrame(() => {
        try { start.el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (_) { /* старый браузер */ }
      });
    }
  }

  /* ── Время ── */

  function paintTime() {
    if (owner === 'library') {
      const key = store.get().preview.key;
      const el = [...listEl().children].find((node) => node.dataset && node.dataset.key === key);
      if (el) {
        const at = Player.time();
        const total = Player.duration() || Player.current()?.duration || 0;
        el.style.setProperty('--p', total > 0 ? Math.min(1, at / total).toFixed(4) : '0');
        el.querySelector('.mrow-time').textContent = Core.clock(at);
      }
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

  /* ── Выбор и прослушивание ── */

  function ensureOpen() {
    if (!store.get().open) store.dispatch({ type: 'open' });
  }

  function listenTo(track) {
    haptic.tap();
    ensureOpen();
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

  function choose(track, startAt) {
    haptic.tap();
    const s = store.get();
    const same = s.saved && s.saved.provider === track.provider && s.saved.trackId === track.id;
    if (owner) Player.stop();
    owner = null;
    store.dispatch({ type: 'select', track, startAt: startAt ?? (same ? s.saved.startAt : 0) });
    start.prepare(track);
    renderView(true);
  }

  function backToLibrary() {
    haptic.tap();
    if (owner === 'start') Player.stop();
    owner = null;
    start.abort();
    store.dispatch({ type: 'back' });
  }

  function setProvider(id) {
    ensureOpen();
    if (id === store.get().provider) return;
    haptic.tap();
    if (owner === 'library') Player.stop();
    owner = null;
    store.dispatch({ type: 'provider', provider: id });
    store.dispatch({ type: 'query', query: id === 'youtube' ? ytQuery : '' });
    mineSeen = null;
    renderSeg();
    renderList();
    search.now();
    if (id === 'youtube') Player.warmYouTube();
    syncPoll();
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
    if (owner) Player.stop();
    owner = null;
    start.abort();
    options.onSave(selection);
    store.dispatch({ type: 'save:done', selection });
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

  /* ── Своя музыка: импорт, файл, бот ── */

  function mineChanged() {
    if (store.get().provider === 'upload') search.retry();
  }

  function follow(job, auto) {
    store.dispatch({ type: 'import:add', job: { ...job, auto } });
    watchJob(job.id);
  }

  function watchJob(id) {
    const job = store.get().imports.find((item) => item.id === id);
    if (!job) return;
    if (job.status === 'done') { jobDone(job); return; }
    if (job.status === 'error') return;
    clearTimeout(jobTimers.get(id));
    jobTimers.set(id, setTimeout(async () => {
      jobTimers.delete(id);
      try {
        const data = await api(`/api/music/import/${encodeURIComponent(id)}`, { auth: true });
        jobFailures.delete(id);
        store.dispatch({ type: 'import:update', job: data.job });
      } catch (error) {
        const failures = (jobFailures.get(id) || 0) + 1;
        jobFailures.set(id, failures);
        if (error.status === 404 || failures >= 4) {
          store.dispatch({ type: 'import:update', job: { id, status: 'error', error: 'failed' } });
          return;
        }
      }
      watchJob(id);
    }, POLL_MS));
  }

  function jobDone(job) {
    if (announced.has(job.id)) return;
    announced.add(job.id);
    haptic.ok();
    mineChanged();
    toast(w('importDone', job.track?.title || job.label), 'ok');
    setTimeout(() => store.dispatch({ type: 'import:remove', id: job.id }), 2600);
    // Импорт запустили, чтобы выбрать песню, — сразу к выбору начала.
    if (job.auto && job.track && store.get().view === 'library') choose(job.track);
  }

  async function submitLink(raw) {
    const value = String(raw || '').trim();
    if (!value || !/https?:\/\//i.test(value)) {
      if (value) toast(importError('link'), 'err');
      els.magicForm.classList.remove('is-shake');
      void els.magicForm.offsetWidth;
      els.magicForm.classList.add('is-shake');
      els.link.focus();
      return;
    }
    if (els.go.disabled) return;
    ensureOpen();
    haptic.tap();
    els.go.disabled = true;
    els.go.classList.add('btn--wait');
    try {
      const data = await api('/api/music/import', { method: 'POST', body: { url: value }, auth: true, timeout: 20000 });
      els.link.value = '';
      els.magicForm.classList.remove('has-link');
      retries.set(data.job.id, () => submitLink(value));
      follow(data.job, true);
    } catch (error) {
      toast(importError(error.message), 'err');
    } finally {
      els.go.disabled = false;
      els.go.classList.remove('btn--wait');
    }
  }

  async function pasteLink() {
    haptic.tap();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        els.link.value = text.trim();
        els.magicForm.classList.toggle('has-link', Boolean(els.link.value));
        if (/https?:\/\//i.test(els.link.value)) submitLink(els.link.value);
        return;
      }
    } catch (_) { /* буфер не дали — вставят сами */ }
    els.link.focus();
  }

  /* Файл уходит на сервер с прогрессом. Звук сразу становится песней, из
     видео звук извлекается задачей — в обоих случаях дальше выбор начала. */
  function uploadMedia(file) {
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) { toast(importError('big'), 'err'); return; }
    ensureOpen();
    const id = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const video = /^video\//.test(file.type) || VIDEO_NAME.test(file.name);
    retries.set(id, () => uploadMedia(file));
    store.dispatch({
      type: 'import:add',
      job: { id, kind: 'file', site: video ? 'video' : 'file', label: file.name.replace(/\.[^.]+$/, '').slice(0, 80), status: 'uploading', stage: 'uploading', progress: 0, auto: true },
    });
    const send = (duration) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/music/upload');
      xhr.setRequestHeader('x-init-data', options.initData());
      xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name.slice(0, 160)));
      if (duration > 0) xhr.setRequestHeader('x-duration', String(Math.round(duration * 100) / 100));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) store.dispatch({ type: 'import:update', job: { id, progress: event.loaded / event.total } });
      };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (_) { data = null; }
        if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
          store.dispatch({ type: 'import:remove', id });
          retries.delete(id);
          if (data.track && Core.validTrack(data.track)) {
            haptic.ok();
            mineChanged();
            if (store.get().view === 'library') choose(data.track);
          } else if (data.job) {
            retries.set(data.job.id, () => uploadMedia(file));
            follow(data.job, true);
          }
          return;
        }
        const code = (data && data.error) || (xhr.status === 413 ? 'big' : xhr.status === 401 ? 'auth' : 'failed');
        store.dispatch({ type: 'import:update', job: { id, status: 'error', error: code } });
      };
      xhr.onerror = () => store.dispatch({ type: 'import:update', job: { id, status: 'error', error: 'failed' } });
      xhr.send(file);
    };
    if (video) { send(0); return; }
    const local = URL.createObjectURL(file);
    probeDuration(local).then((duration) => {
      URL.revokeObjectURL(local);
      send(duration);
    });
  }

  function openBot() {
    haptic.tap();
    const url = options.botUrl();
    if (!url) return;
    try {
      if (tg && tg.openTelegramLink) { tg.openTelegramLink(url); return; }
    } catch (_) { /* старый клиент — откроем вкладкой */ }
    window.open(url, '_blank', 'noopener');
  }

  /* Ролик YouTube выбран — его звук качается в фоне, чтобы у катушки была
     настоящая волна, а у гостей — файл. Не вышло — остаёмся на плеере YouTube. */
  function upgradeYoutube(track, { progress, done, failed }) {
    let over = false;
    let timer = 0;
    let misses = 0;
    const controller = new AbortController();
    const finish = (fn, arg) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      fn(arg);
    };
    const check = (job) => {
      if (over) return;
      if (job.status === 'done' && Core.validTrack(job.track)) { mineChanged(); finish(done, job.track); return; }
      if (job.status === 'error') { finish(failed, job.error); return; }
      progress(job.progress ?? 0);
      timer = setTimeout(async () => {
        try {
          const data = await api(`/api/music/import/${encodeURIComponent(job.id)}`, { auth: true, signal: controller.signal });
          misses = 0;
          check(data.job);
        } catch (_) {
          misses += 1;
          if (misses >= 4) finish(failed, 'failed');
          else check(job);
        }
      }, POLL_MS);
    };
    if (importInfo().link === false) {
      setTimeout(() => finish(failed, 'unavailable'), 0);
    } else {
      api('/api/music/import', { method: 'POST', body: { provider: 'youtube', id: track.id }, auth: true, signal: controller.signal, timeout: 20000 })
        .then((data) => check(data.job), () => finish(failed, 'failed'));
    }
    return {
      cancel() {
        over = true;
        clearTimeout(timer);
        controller.abort();
      },
    };
  }

  /* Песня, пересланная боту, появляется сама: пока своя музыка на экране,
     студия переспрашивает сервер. */
  function syncPoll(want) {
    const s = store.get();
    const visible = Boolean(options.root && options.root.offsetParent !== null);
    const on = want !== false && s.view === 'library' && personal(s.provider) && visible && !document.hidden;
    if (on && !poll) poll = setInterval(() => { if (options.root.offsetParent === null) syncPoll(false); else search.refresh(); }, 5000);
    if (!on && poll) { clearInterval(poll); poll = 0; }
  }

  function noticeMine(s) {
    const ids = s.search.items.map((t) => t.id);
    if (mineSeen) {
      const fresh = s.search.items.find((t) => !mineSeen.has(t.id));
      const imported = s.imports.some((job) => job.track && fresh && job.track.id === fresh.id);
      if (fresh && !imported) toast(w('mineFresh', fresh.title), 'ok');
    }
    mineSeen = new Set(ids);
  }

  /* ── Связки ── */

  function onState(s, prev) {
    if (!built) return;
    if (s.provider !== prev.provider) renderSeg();
    if (s.search !== prev.search || (s.imports.length !== prev.imports.length && personal(s.provider))) {
      renderList();
      if (s.search !== prev.search && s.search.status === 'ready' && personal(s.provider)) noticeMine(s);
    } else if (s.preview !== prev.preview || s.saved !== prev.saved) {
      updateRows();
    }
    if (s.imports !== prev.imports) renderJobs();
    if (s.view !== prev.view) { renderView(); syncPoll(); }
    else if (s.saved !== prev.saved) renderChosen();
    if (s.draft !== prev.draft || s.saving !== prev.saving) start.render();
    options.root.dataset.phase = s.phase;
  }

  function onPlayer(type, detail) {
    const key = Core.trackKey(detail.track);
    if (owner === 'library') {
      if (type === 'playing') store.dispatch({ type: 'preview:playing', key });
      else if (type === 'paused' || type === 'ended') store.dispatch({ type: 'preview:paused', key });
      else if (type === 'error') { store.dispatch({ type: 'preview:error', key, error: detail.code }); toast(w('trackError'), 'err'); }
      else if (type === 'stopped') store.dispatch({ type: 'preview:stop' });
    } else if (owner === 'start') {
      if (type === 'error') toast(w('trackError'), 'err');
      if (type === 'playing') start.paintPlay(true);
      else if (['paused', 'ended', 'error'].includes(type)) start.paintPlay(false);
    } else if (owner === 'card') {
      if (type === 'error') toast(w('trackError'), 'err');
      if (type === 'playing') paintCardPlay('playing');
      else if (type === 'loading' && !Player.isPlaying()) paintCardPlay('loading');
      else if (['paused', 'ended', 'error'].includes(type)) paintCardPlay('idle');
    }
    if (type === 'stopped') {
      if (store.get().preview.key) store.dispatch({ type: 'preview:stop' });
      start.paintPlay(false);
      paintCardPlay('idle');
    }
    if (type === 'playing') runClock();
    else if (['paused', 'ended', 'stopped', 'error'].includes(type)) { stopClock(); paintTime(); }
  }

  function render() {
    build();
    if (!built) return;
    renderTexts();
    renderSeg();
    renderList();
    renderJobs();
    renderView();
    const s = store.get();
    if (s.view === 'library') {
      if (!s.search.key || s.search.status === 'error') search.now();
      if (s.provider === 'youtube') Player.warmYouTube();
    }
    syncPoll();
  }

  function mount(opts) {
    options = opts;
    store = Core.createStore(Core.initialState(opts.selection()));
    search = Core.createSearch({
      store,
      request,
      browses: (id) => id === 'upload',
      personal,
      delay: 350,
    });
    start = NvMusicStart.create({
      store, Core, Player, h, w, icon, cover, haptic, toast, api,
      getOwner: () => owner,
      setOwner: (next) => { owner = next; },
      back: backToLibrary,
      save,
      upgrade: upgradeYoutube,
    });
    store.subscribe(onState);
    Player.subscribe(onPlayer);
    Player.onBlocked((hint) => { if (hint) hint.textContent = w('tapVideo'); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && store.get().view === 'start') { event.preventDefault(); backToLibrary(); }
    });
    document.addEventListener('visibilitychange', () => syncPoll());
    window.addEventListener('pagehide', () => { search.cancel(); Player.destroy(); });
    build();
    if (built) {
      renderTexts();
      renderSeg();
      renderList();
      renderChosen();
    }
    return {
      render,
      open: render,
      close() { if (store.get().view === 'start') backToLibrary(); },
      isOpen: () => store.get().view === 'start',
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
