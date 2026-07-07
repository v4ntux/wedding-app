import express from 'express';
import path from 'node:path';
import { validateInitData } from './initData.js';
import { submitApplication, buildPreviewApp, ValidationError } from './service.js';
import { renderInvitation, renderDemo, renderNotFound, withWatermark } from './render.js';
import { saveUpload, UPLOADS_DIR } from './upload.js';
import * as db from './db.js';
import {
  BOT_TOKEN, DEV_NO_AUTH, TEMPLATES, PREMIUM_GUESTS_PRICE, MAX_GUESTS, MAX_PHOTOS,
  YANDEX_MAPS_API_KEY, EXTRACT_API_URL, EXTRACT_API_KEY,
} from './config.js';
import { RESERVED_SLUGS } from './slug.js';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

function authUser(initData) {
  const user = validateInitData(initData, BOT_TOKEN);
  if (user) return user;
  if (DEV_NO_AUTH) return { id: 0, username: 'dev' };
  return null;
}

// onNewApplication(app) — уведомление админа; подставляется из index.js.
export function createServer({ onNewApplication }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/', (_req, res) => res.redirect('/app/'));
  app.use('/app', express.static(path.join(PUBLIC_DIR, 'app')));
  app.use('/demo', express.static(path.join(PUBLIC_DIR, 'demo')));
  app.use('/music', express.static(path.join(PUBLIC_DIR, 'music')));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Демо шаблона: подставляются имена и язык из формы, поверх — водяная сетка.
  app.get('/demo/:templateId', (req, res, next) => {
    const html = renderDemo(req.params.templateId, {
      groom: req.query.groom,
      bride: req.query.bride,
      lang: req.query.lang,
    });
    if (!html) return next();
    res.send(html);
  });

  // Единый источник правды для формы.
  app.get('/api/config', (_req, res) => {
    res.json({
      templates: TEMPLATES,
      premiumGuestsPrice: PREMIUM_GUESTS_PRICE,
      maxGuests: MAX_GUESTS,
      maxPhotos: MAX_PHOTOS,
      populars: db.templatePopularity(),
      topTracks: db.topMusic(3),
      yandexMapsKey: YANDEX_MAPS_API_KEY,
      extractEnabled: Boolean(EXTRACT_API_URL),
    });
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
