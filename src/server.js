import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { validateInitData } from './initData.js';
import { submitApplication, buildPreviewApp, payApplication, cancelApplication, musicKey, ValidationError } from './service.js';
import { renderInvitation, renderDemo, renderNotFound, withWatermark } from './render.js';
import { saveUpload, UPLOADS_DIR } from './upload.js';
import * as db from './db.js';
import { healthCheck } from './storage.js';
import {
  BOT_TOKEN, RUNTIME, BASE_URL, DEV_NO_AUTH, isAdmin, MAX_GUESTS, MAX_PHOTOS,
  GOOGLE_MAPS_API_KEY, MAP_TILES } from './config.js';
import {
  addTrack, registerTrack, publicTrack, libraryTracks, userTracks, saveLibrary,
  metaFromFileName, youtubeSong, linkSong, MAX_TRACK_BYTES } from './music.js';
import { publicTemplates, publicEvents, allTemplates } from './templateStore.js';
import { guestPrice, pricedAddons, pricingSnapshot, updatePricing } from './pricing.js';
import { publicVenues, allVenues, saveVenues, cityCenter } from './venues.js';
import { RESERVED_SLUGS } from './slug.js';
import { searchYoutube, youtubeVideo, youtubeIdOf, topMoment } from './youtube.js';
import { downloadReady } from './download.js';
import { createStatic, compressResponses } from './static.js';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function rateLimit({ windowMs, max }) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let state = clients.get(key);
    if (!state || state.resetAt <= now) state = { count: 0, resetAt: now + windowMs };
    state.count += 1;
    clients.set(key, state);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - state.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(state.resetAt / 1000)));
    if (state.count > max) return res.status(429).json({ ok: false, error: 'too_many_requests' });
    if (clients.size > 2000 && state.count === 1) {
      for (const [client, value] of clients) if (value.resetAt <= now) clients.delete(client);
    }
    next();
  };
}

function authUser(initData) {
  const user = validateInitData(initData, BOT_TOKEN);
  if (user) return user;
  if (DEV_NO_AUTH) return { id: 0, username: 'dev' };
  return null;
}

// Доступ к админ-панели: только id из ADMIN_CHAT_IDS (или любой в DEV_NO_AUTH — локально).
function adminUser(initData) {
  const u = authUser(initData);
  if (!u) return null;
  if (DEV_NO_AUTH) return u;
  if (isAdmin(u.id)) return u;
  return null;
}

// Имя файла приходит заголовком: тело запроса — сырые байты звука.
function fileNameHeader(req) {
  try {
    return decodeURIComponent(String(req.get('x-file-name') ?? '')).slice(0, 200);
  } catch {
    return '';
  }
}

// onNewApplication(app) — уведомление админа; подставляется из index.js.
export function createServer({ onNewApplication, onPaid } = {}) {
  const app = express();
  // Express 4 needs rejected async handlers forwarded to its error middleware.
  for (const method of ['get', 'post', 'put']) {
    const register = app[method].bind(app);
    app[method] = (route, ...handlers) => register(route, ...handlers.map((handler) =>
      handler.constructor.name === 'AsyncFunction'
        ? (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
        : handler));
  }
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  });
  // Приглашение, демо и ответы формы уезжают сжатыми — гость открывает ссылку с телефона.
  app.use(compressResponses());

  /* Главный адрес — тот, что в BASE_URL (nvate.uz). Старые ссылки и кнопки на
     *.up.railway.app переезжают на него постоянным редиректом, чтобы у
     приглашения был один адрес. Проверку здоровья и API не трогаем. */
  const canonical = (() => { try { return new URL(BASE_URL); } catch { return null; } })();
  app.use((req, res, next) => {
    if (canonical?.protocol !== 'https:' || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    const host = String(req.hostname || '');
    if (host === canonical.hostname || !host.endsWith('.up.railway.app')) return next();
    if (req.path === '/health' || req.path.startsWith('/api/')) return next();
    res.redirect(301, `${canonical.origin}${req.originalUrl}`);
  });

  const geoLimit = rateLimit({ windowMs: 60_000, max: 45 });
  const musicLimit = rateLimit({ windowMs: 60_000, max: 30 });
  // Студия переспрашивает «что пришло в бот», пока открыта вкладка «Моя музыка».
  const mineLimit = rateLimit({ windowMs: 60_000, max: 40 });
  const uploadMb = `${MAX_TRACK_BYTES / 1024 / 1024}mb`;
  const uploadLimit = rateLimit({ windowMs: 10 * 60_000, max: 60 });
  const previewLimit = rateLimit({ windowMs: 60_000, max: 24 });
  const applicationLimit = rateLimit({ windowMs: 10 * 60_000, max: 8 });

  // Продукт — только Telegram WebApp: корень ведёт прямо в форму.
  app.get('/', (_req, res) => res.redirect('/app/'));
  app.get('/health', async (_req, res) => {
    try { res.json(await healthCheck()); }
    catch { res.status(503).json({ status: 'error', database: 'unavailable' }); }
  });
  app.use('/api', (_req, _res, next) => db.refreshSettings().then(() => next(), next));
  /* Студия и админка — код без сборки и без хешей в именах. Без явного запрета
     браузер держит их по эвристике кеширования: после выката пара открывает
     WebApp и получает вчерашний app.js вперемешку с сегодняшней разметкой.
     no-cache не запрещает кеш, а требует сверяться с сервером — ETag тут же
     отдаёт 304, когда ничего не менялось. */
  const freshStatic = { etag: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
  /* Студию отдаёт свой слой: сжатие на лету и тег сборки в ссылках. Разметка
     остаётся под no-cache, а ассеты с ?v= браузер держит вечно — повторный
     вход с того же телефона стоит одного запроса вместо семи. */
  const studio = createStatic(path.join(PUBLIC_DIR, 'app'));
  studio.warm();
  /* Без хвостового слеша относительные ссылки в разметке уехали бы в корень.
     Express без strict routing отдаёт сюда и `/app/`, поэтому путь сверяем
     сами — иначе редирект зациклится сам на себя. */
  app.get('/app', (req, res, next) => (req.path === '/app' ? res.redirect(301, '/app/') : next()));
  app.get(['/app/', '/app/index.html'], studio.shell('index.html'));
  app.use('/app', studio.middleware);
  app.use('/app', express.static(path.join(PUBLIC_DIR, 'app'), freshStatic));
  app.use('/admin', express.static(path.join(PUBLIC_DIR, 'admin'), freshStatic));
  app.use('/demo', express.static(path.join(PUBLIC_DIR, 'demo')));
  app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets')));
  app.use('/music', express.static(path.join(PUBLIC_DIR, 'music')));
  // Customer photos/music are public invitation assets. Payment proofs are not:
  // block them before the generic static handler and expose them only to admins.
  app.use('/uploads', (req, res, next) => {
    const name = path.basename(req.path);
    if (/^proof-\d+-(?:\d+|[0-9a-f-]{36})\.(?:jpe?g|png|webp)$/i.test(name)) return res.sendStatus(404);
    next();
  }, express.static(UPLOADS_DIR));

  // Демо шаблона: подставляются имена и язык из формы, поверх — водяная сетка.
  app.get('/demo/:templateId', (req, res, next) => {
    const html = renderDemo(req.params.templateId, {
      groom: req.query.groom,
      bride: req.query.bride,
      lang: req.query.lang,
      card: req.query.card === '1',
      address: req.query.address,
      map: req.query.map,
      lat: req.query.lat,
      lng: req.query.lng,
      addons: req.query.addons,
      venue: req.query.venue,
      design: { palette: req.query.palette, light: req.query.light, effect: req.query.effect, motion: req.query.motion, typography: req.query.typography },
      date: req.query.date,
      time: req.query.time,
      photos: req.query.photos,
      studio: req.query.studio === '1',
    });
    if (!html) return next();
    res.send(html);
  });

  // Единый источник правды для формы.
  app.get('/api/config', async (_req, res) => {
    res.json({
      templates: publicTemplates(),
      events: publicEvents(),
      botUrl: RUNTIME.botUsername ? `https://t.me/${RUNTIME.botUsername}` : null,
      guestPrice: guestPrice(),
      addons: pricedAddons().filter((addon) => addon.listed !== false),
      maxGuests: MAX_GUESTS,
      maxPhotos: MAX_PHOTOS,
      populars: (await db.templatePopularity()),
      city: cityCenter(),
      mapTiles: MAP_TILES,
      googleGeoEnabled: Boolean(GOOGLE_MAPS_API_KEY),
      downloadEnabled: await downloadReady(),
    });
  });

  // Статистика для админ-панели (только администратор).
  app.get('/api/admin/stats', async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    res.json({ ok: true, stats: (await db.adminStats()), templates: publicTemplates(), orders: (await db.listRecentOrders(30)) });
  });

  // Всё, что нужно панели одним запросом: показатели, заявки, каталог, прайс.
  app.get('/api/admin/overview', async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 60));
    res.json({
      ok: true,
      admin: { id: u.id, username: u.username ?? null },
      stats: (await db.adminStats()),
      templates: publicTemplates(),
      orders: (await db.listRecentOrders(limit)),
      pricing: pricingSnapshot(allTemplates()),
    });
  });

  // Подтверждение оплаты из панели: та же операция, что и кнопкой в боте.
  app.post('/api/admin/applications/:id/pay', express.json({ limit: '4kb' }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Некорректный номер заявки' });
    try {
      const { app: paid, guests } = (await payApplication(id, {
        adminId: u.id,
        adminName: u.username ?? String(u.id),
        proof: null,
      }));
      // Паре уходит ссылка — тем же сообщением, что и при подтверждении из бота.
      if (onPaid) {
        try {
          await onPaid(paid, guests);
        } catch (e) {
          console.error('[server] не удалось уведомить пару:', e.message);
        }
      }
      res.json({ ok: true, id: paid.id, slug: paid.slug, guests });
    } catch (e) {
      if (e instanceof ValidationError) return res.status(400).json({ ok: false, error: e.message });
      console.error('[server] pay error:', e);
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  });

  app.post('/api/admin/applications/:id/cancel', express.json({ limit: '4kb' }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Некорректный номер заявки' });
    try {
      const cancelled = (await cancelApplication(id));
      res.json({ ok: true, id: cancelled.id, status: cancelled.status });
    } catch (e) {
      if (e instanceof ValidationError) return res.status(400).json({ ok: false, error: e.message });
      console.error('[server] cancel error:', e);
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  });

  // Прайс: цены шаблонов, именной ссылки и допфункций. Пустое значение
  // возвращает заводскую цену из manifest.json / config.js.
  app.put('/api/admin/pricing', express.json({ limit: '16kb' }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    try {
      (await updatePricing(req.body ?? {}, allTemplates().map((t) => t.id)));
      res.json({ ok: true, pricing: pricingSnapshot(allTemplates()) });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить цены' });
    }
  });

  // Справочник тойхон: читает каталог целиком (вместе с черновиками) и
  // сохраняет его обратно одной записью — список короткий, склеивать нечего.
  app.get('/api/admin/venues', (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    res.json({ ok: true, city: cityCenter(), venues: allVenues(), mapTiles: MAP_TILES });
  });

  app.put('/api/admin/venues', express.json({ limit: '128kb' }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    try {
      const venues = (await saveVenues(req.body?.venues ?? []));
      res.json({ ok: true, venues });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить каталог' });
    }
  });

  /* Полка nvate: полные треки, которые видят все пары. Пополняется кнопкой
     под присланным боту треком или загрузкой прямо сюда. */
  app.get('/api/admin/library', async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    res.json({ ok: true, tracks: await libraryTracks() });
  });

  app.put('/api/admin/library', express.json({ limit: '64kb' }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    res.json({ ok: true, tracks: await saveLibrary(req.body?.tracks ?? []) });
  });

  // Права проверяем до того, как принять двадцать мегабайт тела.
  const adminOnly = (req, res, next) => (adminUser(req.get('x-init-data') ?? '')
    ? next()
    : res.status(403).json({ ok: false, error: 'forbidden' }));

  app.post('/api/admin/library', adminOnly, uploadLimit, express.raw({ type: () => true, limit: uploadMb }), async (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    const added = await addTrack(req.body, { ...metaFromFileName(fileNameHeader(req)), ownerId: u.id, source: 'admin', library: true });
    if (!added) return res.status(400).json({ ok: false, error: 'Нужен звуковой файл: MP3, M4A, OGG или WAV' });
    if (!Number(added.track.library)) await db.setTrackLibrary(added.track.id, true);
    res.json({ ok: true, track: publicTrack(await db.getTrack(added.track.id)) });
  });

  app.get('/api/admin/proofs/:filename', (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    const name = String(req.params.filename ?? '');
    if (!/^proof-\d+-(?:\d+|[0-9a-f-]{36})\.(?:jpe?g|png|webp)$/i.test(name) || path.basename(name) !== name) {
      return res.sendStatus(404);
    }
    return res.sendFile(path.join(UPLOADS_DIR, name), (error) => {
      if (error && !res.headersSent) res.sendStatus(error.statusCode === 404 ? 404 : 500);
    });
  });

  // Поиск мест. Цепочка провайдеров: Google Places (если есть ключ) → Photon →
  // Nominatim. Все запросы уходят с сервера, поэтому CORS и ключи форму не касаются.
  // Первый непустой ответ и выигрывает — поиск работает и без единого ключа.
  const UZ_BOX = { minLat: 37.0, minLng: 55.9, maxLat: 45.7, maxLng: 73.2 };
  const MANGIT = { lat: 42.116169, lng: 60.0625143 };
  const inUz = (p) => p.lat >= UZ_BOX.minLat && p.lat <= UZ_BOX.maxLat
    && p.lng >= UZ_BOX.minLng && p.lng <= UZ_BOX.maxLng;

  async function geoGoogle(q, lang) {
    if (!GOOGLE_MAPS_API_KEY) return [];
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: q,
        regionCode: 'UZ',
        languageCode: lang,
        pageSize: 6,
        locationRestriction: {
          rectangle: {
            low: { latitude: UZ_BOX.minLat, longitude: UZ_BOX.minLng },
            high: { latitude: UZ_BOX.maxLat, longitude: UZ_BOX.maxLng },
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    return (j.places ?? []).map((p) => ({
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      name: p.displayName?.text ?? '',
      desc: p.formattedAddress ?? '',
    }));
  }

  async function geoPhoton(q, lang) {
    const url = `https://photon.komoot.io/api/?limit=8&lat=${MANGIT.lat}&lon=${MANGIT.lng}`
      + `&lang=${lang === 'ru' ? 'ru' : 'en'}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return (j.features ?? []).map((f) => {
      const p = f.properties ?? {};
      const parts = [p.street, p.district, p.city, p.state].filter(Boolean);
      return {
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
        name: p.name ?? '',
        desc: parts.join(', '),
      };
    });
  }

  async function geoNominatim(q, lang) {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=uz'
      + `&accept-language=${lang}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, {
      // Nominatim отклоняет запросы без User-Agent.
      headers: { 'User-Agent': 'nvate-invites/1.0 (support@nvate.uz)' },
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    return (Array.isArray(j) ? j : []).map((p) => {
      const full = String(p.display_name ?? '');
      const head = full.split(',')[0];
      return {
        lat: Number(p.lat),
        lng: Number(p.lon),
        name: p.name || head,
        desc: full.slice(head.length + 2),
      };
    });
  }

  // Тойхоны Мангита: свой справочник вместо пустой карты — поисковики этих
  // мест не знают. Пары видят только опубликованные записи.
  app.get('/api/venues', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json({ ok: true, city: cityCenter(), venues: publicVenues() });
  });

  app.get('/api/geo/reverse', geoLimit, async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inUz({ lat, lng })) {
      return res.status(400).json({ ok: false, error: 'invalid_coordinates' });
    }
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18'
        + `&accept-language=${lang}&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'nvate-invites/1.0 (support@nvate.uz)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`reverse status ${response.status}`);
      const place = await response.json();
      const address = place.address ?? {};
      const name = place.name || address.amenity || address.tourism || address.building
        || address.road || String(place.display_name ?? '').split(',')[0];
      return res.json({ ok: true, name, address: place.display_name || '' });
    } catch (error) {
      console.error('[server] reverse geo failed:', error.message);
      return res.json({ ok: false, name: '', address: '' });
    }
  });

  app.get('/api/geo', geoLimit, async (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 120).trim();
    if (q.length < 2) return res.json({ ok: true, results: [] });
    const lang = req.query.lang === 'ru' ? 'ru' : 'uz';

    const alreadyLocal = /mang|mańǵ|amud|ámiwd|qaraqal|karakal/i.test(q);
    const localQuery = alreadyLocal ? q : `${q}, Mangit, Amudaryo, Karakalpakstan`;
    const localScore = (p) => {
      const text = `${p.name ?? ''} ${p.desc ?? ''}`.toLowerCase();
      const named = /mang|mańǵ|amud|ámiwd/.test(text) ? 1000 : /qaraqal|karakal/.test(text) ? 400 : 0;
      const distance = Math.hypot((p.lat - MANGIT.lat) * 111, (p.lng - MANGIT.lng) * 82);
      return named - distance;
    };

    for (const [name, provider] of [['google', geoGoogle], ['photon', geoPhoton], ['nominatim', geoNominatim]]) {
      try {
        const nearby = await provider(localQuery, lang);
        const wider = localQuery === q ? [] : await provider(q, lang);
        const seen = new Set();
        const results = [...nearby, ...wider]
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.name || p.desc))
          .filter(inUz)
          .filter((p) => {
            const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => localScore(b) - localScore(a))
          .slice(0, 6);
        if (results.length) {
          const hasLocal = results.some((place) => {
            const distance = Math.hypot((place.lat - MANGIT.lat) * 111, (place.lng - MANGIT.lng) * 82);
            return distance < 28 || /mang|mańǵ|amud|ámiwd/i.test(`${place.name} ${place.desc}`);
          });
          if (!hasLocal) {
            results.unshift({
              lat: MANGIT.lat,
              lng: MANGIT.lng,
              name: q,
              desc: lang === 'ru'
                ? 'Мангит, Амударьинский район — уточните точку на карте'
                : 'Mang‘it, Amudaryo tumani — nuqtani xaritada aniqlashtiring',
              approximate: true,
            });
          }
          return res.json({ ok: true, results: results.slice(0, 6), source: name });
        }
      } catch (e) {
        console.error(`[server] geo ${name} failed:`, e.message);
      }
    }
    res.json({ ok: true, results: [] });
  });

  // «Мои приглашения»: заявки текущего пользователя Telegram.
  app.get('/api/my', async (req, res) => {
    const user = authUser(req.get('x-init-data') ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    const apps = await Promise.all((await db.listApplicationsByUser(user.id)).map(async (a) => {
      const paid = a.status === 'paid' && a.slug;
      // Именные ссылки гостей — только у оплаченных (создаются при оплате).
      const guests = paid && a.premium
        ? (await db.listGuests(a.id)).map((g) => ({ name: g.name, url: `${BASE_URL}/${a.slug}/${g.slug}` }))
        : [];
      return {
        id: a.id,
        groom: a.groom_name,
        bride: a.bride_name,
        date: a.wedding_date,
        time: a.wedding_time,
        templateId: a.template_id,
        status: a.status,
        total: a.total_price,
        templatePrice: a.template_price,
        guestsPrice: a.premium_price,
        url: paid ? `${BASE_URL}/${a.slug}` : null,
        guests,
        createdAt: a.created_at,
      };
    }));
    res.json({ ok: true, apps });
  });

  /* Музыка — только полные треки. Каталог iTunes отдавал тридцать секунд
     превью: с началом на 0:17 гости слышали тринадцать секунд и петлю.
     Полка nvate — целые файлы на нашем сервере. */
  app.get('/api/music', musicLimit, async (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.json({ ok: true, tracks: await libraryTracks() });
  });

  // Личные треки пары: присланные боту и загруженные в студии.
  app.get('/api/music/mine', mineLimit, async (req, res) => {
    const user = authUser(req.get('x-init-data') ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, tracks: await userTracks(user.id) });
  });

  // Поиск песен на YouTube. Песню сервер скачивает к себе, и запрет автора на
  // встраивание ей не мешает; без yt-dlp она играет плеером — тогда запрет важен.
  app.get('/api/music/youtube/search', musicLimit, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const embeddable = !(await downloadReady());
    res.json({ ok: true, results: await searchYoutube(String(req.query.q ?? ''), { embeddable }) });
  });

  // Вставленная ссылка: название ролика и разрешение на показ в приглашении.
  app.get('/api/music/youtube/info', musicLimit, async (req, res) => {
    const found = await youtubeVideo(String(req.query.url ?? '').slice(0, 300));
    if (found.status === 'ok') return res.json({ ok: true, video: found.video });
    const code = { 'bad-link': 400, blocked: 422, unavailable: 502 }[found.status] ?? 502;
    res.status(code).json({ ok: false, error: found.status });
  });

  /* «Топ выбор»: откуда этот трек обычно запускают. Пара услышит подсказку
     раньше, чем начнёт искать нужный такт пальцем. Одна чужая обрезка — ещё не
     рекомендация, поэтому, пока пар меньше двух, подсказывает YouTube: самый
     переслушиваемый момент песни. */
  app.get('/api/music/cut', musicLimit, async (req, res) => {
    const type = String(req.query.type ?? '');
    const key = musicKey({ musicType: type, musicValue: String(req.query.url ?? '').slice(0, 400) });
    let cut = key ? await db.popularCut(key) : null;
    if (!cut && key && (type === 'upload' || type === 'youtube')) {
      const top = type === 'upload' ? (await db.trackByFile(key))?.top_start : await topMoment(youtubeIdOf(key));
      if (top !== null && top !== undefined) cut = { start: Number(top), uses: 0 };
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ ok: true, cut });
  });

  /* Песня по ссылке или из поиска — целиком, чтобы у неё были волна и выбор
     начала. YouTube скачивается один раз на всех, звук из TikTok и Instagram
     становится личной песней пары. Другие адреса yt-dlp не отдаём: сервер пошёл
     бы за ними куда угодно, в том числе во внутреннюю сеть. */
  const songLimit = rateLimit({ windowMs: 10 * 60_000, max: 30 });
  const SONG_HOSTS = /(^|\.)(instagram\.com|tiktok\.com)$/i;
  app.post('/api/music/link', songLimit, express.json({ limit: '4kb' }), async (req, res) => {
    const user = authUser(req.get('x-init-data') ?? req.body?.initData ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    const url = String(req.body?.url ?? '').trim().slice(0, 300);
    const id = youtubeIdOf(url);
    let host = '';
    try {
      const parsed = new URL(url);
      host = parsed.protocol === 'https:' ? parsed.hostname : '';
    } catch { /* не ссылка */ }
    if (!id && !SONG_HOSTS.test(host)) return res.status(400).json({ ok: false, error: 'bad-link' });
    if (!(await downloadReady())) return res.status(501).json({ ok: false, error: 'download-off' });
    try {
      const track = id ? await youtubeSong(id) : await linkSong(url, user.id);
      if (!track) return res.status(502).json({ ok: false, error: 'download-failed' });
      res.json({ ok: true, track: publicTrack(track) });
    } catch (e) {
      console.error('[server] song download failed:', e.message);
      res.status(502).json({ ok: false, error: 'download-failed' });
    }
  });

  // Загрузка фото и аудио: сырые байты, тип определяем по сигнатуре.
  app.post('/api/upload', uploadLimit, express.raw({ type: () => true, limit: uploadMb }), async (req, res) => {
    const user = authUser(req.get('x-init-data') ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ ok: false, error: 'Пустой файл' });
    }
    const saved = saveUpload(req.body);
    if (!saved) return res.status(400).json({ ok: false, error: 'Формат не поддерживается (JPG/PNG/WebP, MP3/M4A/OGG/WAV)' });
    // Звук остаётся в «Моей музыке»: сменил трек — к загруженному можно вернуться.
    const track = saved.kind === 'audio'
      ? publicTrack(await registerTrack(saved.file, { ...metaFromFileName(fileNameHeader(req)), ownerId: user.id, source: 'upload' }))
      : null;
    res.json({ ok: true, file: saved.file, kind: saved.kind, track });
  });

  // Предпросмотр перед подтверждением: полная открытка с данными формы + водяная сетка.
  app.post('/api/preview', previewLimit, express.json({ limit: '64kb' }), (req, res) => {
    try {
      const { initData, form } = req.body ?? {};
      const user = authUser(initData);
      if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
      const previewApp = buildPreviewApp(form);
      res.json({ ok: true, html: withWatermark(renderInvitation(previewApp)) });
    } catch (e) {
      if (e instanceof ValidationError) {
        return res.status(400).json({ ok: false, error: e.message, step: e.step });
      }
      console.error('[server] preview error:', e);
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  });

  app.post('/api/applications', applicationLimit, express.json({ limit: '64kb' }), async (req, res) => {
    try {
      const { initData, form } = req.body ?? {};
      const user = authUser(initData);
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
      }

      const { id, app: created } = (await submitApplication(form, user));

      try {
        await onNewApplication(created);
      } catch (e) {
        // Заявка сохранена — админ увидит её в базе, даже если Telegram недоступен.
        console.error('[server] admin notify failed:', e);
      }

      res.json({ ok: true, id });
    } catch (e) {
      if (e instanceof ValidationError) {
        return res.status(400).json({ ok: false, error: e.message, step: e.step });
      }
      console.error('[server] submit error:', e);
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  });

  // Страница приглашения: project.uz/ali-and-zebo
  app.get('/:slug', async (req, res, next) => {
    const { slug } = req.params;
    if (RESERVED_SLUGS.has(slug)) return next();
    const invitation = (await db.getApplicationBySlug(slug));
    if (!invitation) return next();
    res.send(renderInvitation(invitation));
  });

  // Именная страница: project.uz/ali-and-zebo/aziz
  app.get('/:slug/:guestSlug', async (req, res, next) => {
    const { slug, guestSlug } = req.params;
    if (RESERVED_SLUGS.has(slug)) return next();
    const invitation = (await db.getApplicationBySlug(slug));
    if (!invitation) return next();
    const guest = (await db.getGuest(invitation.id, guestSlug));
    // Незнакомый гость видит общую открытку — битых ссылок не бывает.
    res.send(renderInvitation(invitation, guest?.name ?? null));
  });

  app.use((_req, res) => res.status(404).send(renderNotFound()));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[server] error:', err);
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ ok: false, error: 'Файл слишком большой или запрос некорректен' });
    }
    res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
  });

  // Возвращаем http-сервер, а не голое приложение: тестам нужны address()
  // и close(), а вызывающему коду достаточно привычного listen().
  return http.createServer(app);
}
