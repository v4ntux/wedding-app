import express from 'express';
import path from 'node:path';
import { validateInitData } from './initData.js';
import { submitApplication, buildPreviewApp, ValidationError } from './service.js';
import { renderInvitation, renderDemo, renderNotFound, withWatermark } from './render.js';
import { saveUpload, UPLOADS_DIR } from './upload.js';
import * as db from './db.js';
import {
  BOT_TOKEN, BOT_USERNAME, BASE_URL, DEV_NO_AUTH, isAdmin, GUEST_LINK_PRICE, MAX_GUESTS, MAX_PHOTOS,
  YANDEX_MAPS_API_KEY, GOOGLE_MAPS_API_KEY, EXTRACT_API_URL, EXTRACT_API_KEY,
} from './config.js';
import { publicTemplates, publicEvents } from './templateStore.js';
import { RESERVED_SLUGS } from './slug.js';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

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

// onNewApplication(app) — уведомление админа; подставляется из index.js.
export function createServer({ onNewApplication }) {
  const app = express();
  app.disable('x-powered-by');

  // Продукт — только Telegram WebApp: корень ведёт прямо в форму.
  app.get('/', (_req, res) => res.redirect('/app/'));
  app.use('/app', express.static(path.join(PUBLIC_DIR, 'app')));
  app.use('/admin', express.static(path.join(PUBLIC_DIR, 'admin')));
  app.use('/demo', express.static(path.join(PUBLIC_DIR, 'demo')));
  app.use('/music', express.static(path.join(PUBLIC_DIR, 'music')));
  app.use('/uploads', express.static(UPLOADS_DIR));

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
      date: req.query.date,
      time: req.query.time,
    });
    if (!html) return next();
    res.send(html);
  });

  // Единый источник правды для формы.
  app.get('/api/config', (_req, res) => {
    res.json({
      templates: publicTemplates(),
      events: publicEvents(),
      botUrl: BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null,
      guestPrice: GUEST_LINK_PRICE,
      maxGuests: MAX_GUESTS,
      maxPhotos: MAX_PHOTOS,
      populars: db.templatePopularity(),
      topTracks: db.topMusic(3),
      yandexMapsKey: YANDEX_MAPS_API_KEY,
      googleGeoEnabled: Boolean(GOOGLE_MAPS_API_KEY),
      extractEnabled: Boolean(EXTRACT_API_URL),
    });
  });

  // Статистика для админ-панели (только администратор).
  app.get('/api/admin/stats', (req, res) => {
    const u = adminUser(req.get('x-init-data') ?? '');
    if (!u) return res.status(403).json({ ok: false, error: 'forbidden' });
    res.json({ ok: true, stats: db.adminStats(), templates: publicTemplates(), orders: db.listRecentOrders(30) });
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

  app.get('/api/geo/reverse', async (req, res) => {
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

  app.get('/api/geo', async (req, res) => {
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
  app.get('/api/my', (req, res) => {
    const user = authUser(req.get('x-init-data') ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    const apps = db.listApplicationsByUser(user.id).map((a) => {
      const paid = a.status === 'paid' && a.slug;
      // Именные ссылки гостей — только у оплаченных (создаются при оплате).
      const guests = paid && a.premium
        ? db.listGuests(a.id).map((g) => ({ name: g.name, url: `${BASE_URL}/${a.slug}/${g.slug}` }))
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
    });
    res.json({ ok: true, apps });
  });

  // Каталог музыки: прокси к iTunes Search (30-сек превью, без ключей).
  app.get('/api/music', async (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100).trim() || 'wedding instrumental piano';
    try {
      const r = await fetch(
        `https://itunes.apple.com/search?media=music&limit=24&term=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const j = await r.json();
      const tracks = (j.results ?? [])
        .filter((t) => t.previewUrl)
        .map((t) => ({
          name: t.trackName,
          artist: t.artistName,
          url: t.previewUrl,
          art: t.artworkUrl60 ?? null,
        }));
      res.json({ ok: true, tracks });
    } catch (e) {
      console.error('[server] music search failed:', e.message);
      res.json({ ok: true, tracks: [] });
    }
  });

  // Извлечение аудио из видео-ссылки (Instagram/TikTok/YouTube) через cobalt-совместимый API.
  app.post('/api/extract', express.json({ limit: '4kb' }), async (req, res) => {
    const user = authUser(req.get('x-init-data') ?? req.body?.initData ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    if (!EXTRACT_API_URL) {
      return res.status(501).json({ ok: false, error: 'extract-not-configured' });
    }
    const url = String(req.body?.url ?? '').slice(0, 300);
    if (!/^https?:\/\/\S+$/.test(url)) return res.status(400).json({ ok: false, error: 'Некорректная ссылка' });
    try {
      const r = await fetch(EXTRACT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(EXTRACT_API_KEY ? { Authorization: `Api-Key ${EXTRACT_API_KEY}` } : {}),
        },
        body: JSON.stringify({ url, downloadMode: 'audio', audioFormat: 'mp3' }),
        signal: AbortSignal.timeout(30000),
      });
      const j = await r.json();
      const dl = j?.url;
      if (!dl) throw new Error(j?.error?.code ?? 'no url');
      const audioRes = await fetch(dl, { signal: AbortSignal.timeout(90000) });
      const buf = Buffer.from(await audioRes.arrayBuffer());
      if (buf.length === 0 || buf.length > 16 * 1024 * 1024) throw new Error('bad size');
      const saved = saveUpload(buf);
      if (!saved || saved.kind !== 'audio') throw new Error('not audio');
      res.json({ ok: true, file: saved.file });
    } catch (e) {
      console.error('[server] extract failed:', e.message);
      res.status(502).json({ ok: false, error: 'extract-failed' });
    }
  });

  // Загрузка фото и аудио: сырые байты, тип определяем по сигнатуре.
  app.post('/api/upload', express.raw({ type: () => true, limit: '16mb' }), (req, res) => {
    const user = authUser(req.get('x-init-data') ?? '');
    if (!user) return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ ok: false, error: 'Пустой файл' });
    }
    const saved = saveUpload(req.body);
    if (!saved) return res.status(400).json({ ok: false, error: 'Формат не поддерживается (JPG/PNG/WebP, MP3/M4A/OGG/WAV)' });
    res.json({ ok: true, file: saved.file, kind: saved.kind });
  });

  // Предпросмотр перед подтверждением: полная открытка с данными формы + водяная сетка.
  app.post('/api/preview', express.json({ limit: '64kb' }), (req, res) => {
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

  app.post('/api/applications', express.json({ limit: '64kb' }), async (req, res) => {
    try {
      const { initData, form } = req.body ?? {};
      const user = authUser(initData);
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Откройте форму через Telegram-бота' });
      }

      const { id, app: created } = submitApplication(form, user);

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
  app.get('/:slug', (req, res, next) => {
    const { slug } = req.params;
    if (RESERVED_SLUGS.has(slug)) return next();
    const invitation = db.getApplicationBySlug(slug);
    if (!invitation) return next();
    res.send(renderInvitation(invitation));
  });

  // Именная страница: project.uz/ali-and-zebo/aziz
  app.get('/:slug/:guestSlug', (req, res, next) => {
    const { slug, guestSlug } = req.params;
    if (RESERVED_SLUGS.has(slug)) return next();
    const invitation = db.getApplicationBySlug(slug);
    if (!invitation) return next();
    const guest = db.getGuest(invitation.id, guestSlug);
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

  return app;
}
