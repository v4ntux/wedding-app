/* Статика студии без сборщика.

   Студия — это 300 КБ текста: app.js, style.css, разметка и карта. Express
   отдавал их сырыми байтами, поэтому первый вход с чужого телефона упирался
   не в отрисовку, а в канал: по мобильной сети такой объём едет секунды.
   Здесь он же едет сжатым — brotli снимает с текста около восьмидесяти
   процентов веса, и первый экран появляется на первом же вдохе.

   Второе: версия. Раньше на весь /app стоял no-cache, и каждый повторный
   вход заново спрашивал сервер про каждый файл. Теперь ссылки в разметке
   помечены общим тегом сборки (__V__), а всё, что пришло с ?v=, браузер и
   Cloudflare держат вечно. Тег — отпечаток содержимого каталога, а не дат:
   выкат на Railway раскладывает файлы заново со свежими mtime, и тег по датам
   сбрасывал бы кеш студии даже там, где в ней не поменялось ни байта. Меняется
   любой ассет — меняется тег, и пара получает новый комплект целиком, без
   вчерашнего app.js поверх сегодняшней разметки.

   Третье: ластик (minify.js). Комментарии и отступы остаются в исходниках,
   а наружу уходит текст без них — после brotli это ещё четверть веса. */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { minifyCss, minifyHtml, minifyJs, MINIFY_REVISION } from './minify.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

// Сжимаем только текст: woff2 и картинки уже сжаты, второй проход лишь греет CPU.
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.map']);
// Всё остальное (видео, аудио, диапазонные запросы) уходит дальше в express.static.
const SERVED = new Set([...COMPRESS, '.woff2', '.woff', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);

const YEAR = 60 * 60 * 24 * 365;
const MIN_GAIN = 860; // мельче килобайта сжимать незачем: заголовки съедят выигрыш.

/* Ластик по типу файла. Споткнётся — уйдёт исходник: лёгкость не стоит
   сломанной студии. */
const ERASERS = { '.js': minifyJs, '.css': minifyCss, '.html': minifyHtml };
function slim(ext, source) {
  const erase = ERASERS[ext];
  if (!erase) return source;
  try {
    const text = source.toString('utf8');
    const out = erase(text);
    return out === text ? source : Buffer.from(out, 'utf8');
  } catch {
    return source;
  }
}

const brotliOpts = (buf, quality) => ({
  params: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
  },
});

const brotli = (buf, quality) => zlib.brotliCompressSync(buf, brotliOpts(buf, quality));
/* Максимальное сжатие уходит в пул потоков: q11 на скрипте студии — это
   доли секунды работы, и держать на них весь event loop нельзя. */
const brotliSlow = (buf) => new Promise((done, fail) =>
  zlib.brotliCompress(buf, brotliOpts(buf, 11), (err, out) => (err ? fail(err) : done(out))));
const gzipSlow = (buf) => new Promise((done, fail) =>
  zlib.gzip(buf, { level: 9 }, (err, out) => (err ? fail(err) : done(out))));

/* Собранные на лету ответы: страница приглашения, демо шаблона, JSON формы.
   Приглашение — это восемьдесят килобайт разметки со стилями внутри, и едет
   оно ровно к тем, у кого канал хуже всего: к гостям, открывающим ссылку с
   телефона. Жмём быстрым уровнем — ответ собирается под запрос, и секунда
   процессорного времени здесь дороже пары сэкономленных килобайт. */
const TEXTUAL = /^(?:text\/|application\/(?:json|javascript|xml)|image\/svg)/i;

export function compressResponses({ min = MIN_GAIN } = {}) {
  return (req, res, next) => {
    const send = res.send.bind(res);
    res.send = (body) => {
      const ready = typeof body === 'string' || Buffer.isBuffer(body);
      if (!ready || res.getHeader('Content-Encoding')) return send(body);

      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      if (buf.length < min) return send(body);

      /* Тип ответа Express дописывает уже внутри send — для строки это html.
         Смотрим на то, что известно сейчас, и на строке считаем разметкой. */
      const type = String(res.getHeader('Content-Type') || (typeof body === 'string' ? 'text/html' : ''));
      if (!TEXTUAL.test(type)) return send(body);

      /* Ответ зависит от Accept-Encoding, даже когда этот клиент сжатия не
         просил: иначе общий кеш отдаст несжатую копию тем, кто умеет brotli.
         vary() дописывает заголовок, а не затирает уже выставленный. */
      res.vary('Accept-Encoding');
      const accepts = String(req.headers['accept-encoding'] || '');
      let out = null;
      // q5 на восьмидесяти килобайтах приглашения — три миллисекунды и вчетверо меньше байт.
      if (/\bbr\b/.test(accepts)) { out = brotli(buf, 5); res.setHeader('Content-Encoding', 'br'); }
      else if (/\bgzip\b/.test(accepts)) { out = zlib.gzipSync(buf, { level: 6 }); res.setHeader('Content-Encoding', 'gzip'); }
      if (!out) return send(body);

      if (!res.getHeader('Content-Type')) res.type(typeof body === 'string' ? 'html' : 'bin');
      res.setHeader('Content-Length', String(out.length));
      return send(out);
    };
    next();
  };
}

export function createStatic(root, { index = null } = {}) {
  const dir = path.resolve(root);
  /* Кеш собранного ответа на файл: стёртые байты, brotli, gzip и ETag.
     Ключ — абсолютный путь, свежесть проверяется по mtime и размеру. */
  const cache = new Map();

  function load(file, stat) {
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit;
    const source = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const raw = slim(ext, source);
    const entry = {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      type: MIME[ext] || 'application/octet-stream',
      etag: `"${crypto.createHash('sha1').update(MINIFY_REVISION).update(source).digest('base64url')}"`,
      raw,
      br: null,
      gz: null,
      best: null, // обещание догоняющего сжатия на максимуме
    };
    if (COMPRESS.has(ext) && raw.length >= MIN_GAIN) {
      /* На горячем пути жмём быстро (q5 ≈ миллисекунды), а максимум (q11)
         догоняет фоном — иначе первый посетитель после выката ждёт, пока
         сервер перемалывает 150 КБ скрипта. */
      entry.gz = zlib.gzipSync(raw, { level: 6 });
      entry.br = brotli(raw, 5);
      entry.best = Promise.all([brotliSlow(raw), gzipSlow(raw)]).then(([br, gz]) => {
        if (cache.get(file) !== entry) return;
        entry.br = br;
        entry.gz = gz;
      }, () => { /* не догнали максимум — остаёмся на быстром сжатии */ });
    }
    cache.set(file, entry);
    return entry;
  }

  /* Тег сборки: отпечаток содержимого каталога. Отпечатки файлов помним по
     mtime и размеру, поэтому заново читается только то, что поменялось, а сам
     обход повторяется не чаще раза в две секунды. */
  const prints = new Map();
  function print(file, stat) {
    const hit = prints.get(file);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.hash;
    const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('base64url');
    prints.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, hash });
    return hash;
  }

  let stamp = { value: '0', at: 0 };
  function version() {
    const now = Date.now();
    if (now - stamp.at < 2000) return stamp.value;
    const sum = crypto.createHash('sha1').update(MINIFY_REVISION);
    const walk = (folder) => {
      let items;
      try { items = fs.readdirSync(folder, { withFileTypes: true }); } catch { return; }
      for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(folder, item.name);
        if (item.isDirectory()) { walk(full); continue; }
        try {
          sum.update(`${path.relative(dir, full)}:${print(full, fs.statSync(full))}\n`);
        } catch { /* файл исчез между чтениями каталога — состав просто изменится */ }
      }
    };
    walk(dir);
    stamp = { value: sum.digest('base64url').slice(0, 10), at: now };
    return stamp.value;
  }

  function send(req, res, entry, cacheControl) {
    res.setHeader('Content-Type', entry.type);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('ETag', entry.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Last-Modified', new Date(entry.mtimeMs).toUTCString());

    const known = String(req.headers['if-none-match'] || '');
    if (known && known.split(',').some((tag) => tag.trim().replace(/^W\//, '') === entry.etag)) {
      return res.status(304).end();
    }

    const accepts = String(req.headers['accept-encoding'] || '');
    let body = entry.raw;
    if (entry.br && /\bbr\b/.test(accepts)) { body = entry.br; res.setHeader('Content-Encoding', 'br'); }
    else if (entry.gz && /\bgzip\b/.test(accepts)) { body = entry.gz; res.setHeader('Content-Encoding', 'gzip'); }

    res.setHeader('Content-Length', String(body.length));
    if (req.method === 'HEAD') return res.end();
    res.end(body);
  }

  const middleware = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    let rel;
    try { rel = decodeURIComponent(req.path); } catch { return next(); }
    if (rel.includes('\0')) return next();
    if (index && (rel === '/' || rel.endsWith('/'))) rel += index;

    const file = path.resolve(dir, `.${rel}`);
    // Выход за корень каталога — не наш файл, пусть решает следующий обработчик.
    if (file !== dir && !file.startsWith(dir + path.sep)) return next();

    const ext = path.extname(file).toLowerCase();
    if (!SERVED.has(ext)) return next();

    let stat;
    try { stat = fs.statSync(file); } catch { return next(); }
    if (!stat.isFile()) return next();

    const entry = load(file, stat);
    /* Разметку всегда сверяем с сервером: в ней живёт тег сборки, и именно она
       решает, какие ассеты подтянет браузер. Навечно отдаём только файл под
       текущим тегом. Чужой тег — это разметка другого выката (страница открыта
       со вчера или ответил ещё не погашенный экземпляр): отдаём то, что лежит
       сейчас, но с проверкой, иначе Cloudflare на год запомнит под этим
       адресом не тот файл. */
    const tag = typeof req.query?.v === 'string' ? req.query.v : '';
    const control = ext !== '.html' && tag && tag === version()
      ? `public, max-age=${YEAR}, immutable`
      : 'no-cache';
    return send(req, res, entry, control);
  };

  /* Разметка с подставленным тегом сборки. Держим отдельно от общего кеша:
     на диске лежит шаблон с __V__, наружу уходит уже готовый HTML. */
  const shells = new Map();
  function shell(name) {
    const file = path.resolve(dir, name);
    if (file !== dir && !file.startsWith(dir + path.sep)) throw new Error('shell outside root');
    return (req, res, next) => {
      let stat;
      try { stat = fs.statSync(file); } catch { return next(); }
      const tag = version();
      const hit = shells.get(file);
      let entry = hit && hit.mtimeMs === stat.mtimeMs && hit.tag === tag ? hit : null;
      if (!entry) {
        const page = slim('.html', fs.readFileSync(file)).toString('utf8').replaceAll('__V__', tag);
        const html = Buffer.from(page, 'utf8');
        entry = {
          mtimeMs: stat.mtimeMs,
          tag,
          type: MIME['.html'],
          etag: `"${crypto.createHash('sha1').update(html).digest('base64url')}"`,
          raw: html,
          gz: zlib.gzipSync(html, { level: 9 }),
          br: brotli(html, 9), // разметка мелкая: q9 даёт тот же вес за долю времени q11
        };
        shells.set(file, entry);
      }
      return send(req, res, entry, 'no-cache');
    };
  }

  /* Прогрев: к первому запросу ластик уже прошёлся, а brotli лежит на максимуме. */
  async function warm() {
    const seen = [];
    const walk = async (folder) => {
      let items;
      try { items = await fsp.readdir(folder, { withFileTypes: true }); } catch { return; }
      for (const item of items) {
        const full = path.join(folder, item.name);
        if (item.isDirectory()) { await walk(full); continue; }
        if (COMPRESS.has(path.extname(item.name).toLowerCase())) seen.push(full);
      }
    };
    await walk(dir);
    for (const file of seen) {
      try { await load(file, await fsp.stat(file)).best; } catch { /* пропавший файл прогревать нечего */ }
    }
  }

  return { middleware, shell, version, warm };
}
