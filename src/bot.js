import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { payApplication, cancelApplication, ValidationError, mapsLinks } from './service.js';
import { findMusicPreset, SUPPORT_URL, ADDONS, GUEST_LINK_PRICE, MAX_PHOTOS } from './config.js';
import { findTemplate, publicTemplates } from './templateStore.js';
import { markMainSent, markGuestSent, getApplication, listGuests, refreshSettings, trackByTelegram, getApplicationBySlug, getGuestById, setGuestMessage, touchUser } from './db.js';
import { text, textLang } from './texts.js';
import { UPLOADS_DIR } from './upload.js';
import { escapeHtml as esc } from './render.js';
import { addTrack, metaFromFileName, trackLabel, MAX_TRACK_BYTES } from './music.js';
import { importLink, importVideo, waitForImport } from './musicImport.js';
import { siteOf } from './extract.js';
import { parseMusicMeta } from './musicSelection.js';
import { renderShareCard } from './share.js';

function money(n) {
  return `${Number(n).toLocaleString('ru-RU')} сум`;
}

const MUSIC_SOURCES = { nvate: 'nVate', audius: 'Audius', youtube: 'YouTube', upload: 'свой файл' };

function musicLine(app, musicTitle = null) {
  const meta = parseMusicMeta(app.music_meta);
  if (meta?.title) {
    const source = MUSIC_SOURCES[app.music_type];
    return `${[meta.title, meta.artist].filter(Boolean).join(' — ')}${source ? ` · ${source}` : ''}`;
  }
  if (app.music_type === 'upload' && musicTitle) return musicTitle;
  if (app.music_type === 'preset') return findMusicPreset(app.music_value)?.name ?? app.music_value;
  if (app.music_type === 'itunes') {
    try {
      const value = JSON.parse(app.music_value ?? '{}');
      return [value.name, value.artist].filter(Boolean).join(' — ') || 'трек из каталога';
    } catch { return 'трек из каталога'; }
  }
  if (app.music_type === 'upload') return 'загруженный аудиофайл';
  if (app.music_type === 'youtube') return app.music_value || 'YouTube';
  if (app.music_type === 'custom') return app.music_value;
  return 'без музыки';
}

function photoCount(app) {
  try {
    return JSON.parse(app.photos ?? '[]').length;
  } catch {
    return 0;
  }
}

const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
};

// «19-sentabr, 2027» / «19 сентября 2027» — дата свадьбы на языке пары.
function weddingDate(app) {
  const [y, m, d] = String(app.wedding_date ?? '').split('-').map(Number);
  if (!y || !m || !d) return esc(app.wedding_date ?? '');
  return app.lang === 'ru' ? `${d} ${MONTHS.ru[m - 1]} ${y}` : `${d}-${MONTHS.uz[m - 1]}, ${y}`;
}

const STATUS_LINE = {
  new: '🆕 НОВАЯ ЗАЯВКА',
  paid: '✅ ОПЛАЧЕНО',
  cancelled: '❌ ОТКЛОНЕНА',
};

export function buildAdminText(app, { baseUrl, guests = [], musicTitle = null } = {}) {
  const links = mapsLinks(app.lat, app.lng);
  const template = findTemplate(app.template_id);
  const lines = [
    `${STATUS_LINE[app.status] ?? app.status} — заявка #${app.id}`,
    '',
    `🤵 Жених: <b>${esc(app.groom_name)}</b>`,
    `👰 Невеста: <b>${esc(app.bride_name)}</b>`,
    `📅 ${esc(app.wedding_date)}  🕐 ${esc(app.wedding_time)}`,
    `📍 ${esc(app.address ?? 'адрес не указан')}`,
    `🎵 ${esc(musicLine(app, musicTitle))}${app.music_start > 0 ? ` (с ${Math.floor(app.music_start / 60)}:${String(Math.floor(app.music_start % 60)).padStart(2, '0')})` : ''}`,
    `📷 Фото: ${photoCount(app)} шт.`,
    `🎨 Шаблон: ${esc(template?.name ?? app.template_id)} — ${money(app.template_price)}`,
  ];
  if (app.map_enabled !== 0) lines.splice(6, 0, `<a href="${links.google}">Google Maps</a> | <a href="${links.yandex}">Yandex Maps</a>`);
  if (app.premium) {
    const count = JSON.parse(app.guest_names ?? '[]').length;
    lines.push(`⭐ Именные приглашения: ${count} гостей (+${money(app.premium_price)})`);
  }
  // Дополнительные функции: подписи и цены берём из каталога, чтобы карточка
  // админа не разъезжалась с формой при добавлении новой опции.
  let extras = {};
  try { extras = app.extras ? JSON.parse(app.extras) : {}; } catch { extras = {}; }
  for (const addon of ADDONS) {
    if (extras[addon.id]) lines.push(`✨ ${esc(addon.ru)} (+${money(addon.price)})`);
  }
  if (app.domain_enabled && !extras.domain) lines.push(`🔗 Именной домен на 1 год (+${money(app.domain_price)})`);
  lines.push(`💰 Итого: <b>${money(app.total_price)}</b>`);
  lines.push(`👤 От: ${app.tg_username ? '@' + esc(app.tg_username) : ''} (id ${app.tg_user_id})`);
  if (app.contact_tg) lines.push(`📨 Telegram: @${esc(app.contact_tg)}`);
  if (app.phone) lines.push(`📞 ${esc(app.phone)}`);
  if (app.phone2) lines.push(`📞 Доп.: ${esc(app.phone2)}`);

  if (app.status === 'paid' && app.slug) {
    lines.push('', `🔗 ${baseUrl}/${app.slug}`);
    for (const g of guests) {
      lines.push(`• ${esc(g.name)}: ${baseUrl}/${app.slug}/${g.slug}`);
    }
  }
  return lines.join('\n');
}

function buildCoupleText(app, guests, baseUrl) {
  const lines = [
    '🎉 Оплата подтверждена! Ваше приглашение готово:',
    '',
    `🔗 ${baseUrl}/${app.slug}`,
  ];
  if (guests.length > 0) {
    lines.push('', '⭐ Именные ссылки для гостей:');
    for (const g of guests) {
      lines.push(`• ${g.name}: ${baseUrl}/${app.slug}/${g.slug}`);
    }
  }
  lines.push('', 'Поделитесь ссылкой с гостями. Поздравляем! 💐');
  return lines.join('\n');
}

export function createBot({ token, adminIds = [], baseUrl }) {
  const bot = new Bot(token);
  bot.use(async (_ctx, next) => { await refreshSettings(); await next(); });
  // Админов может быть несколько: ADMIN_CHAT_IDS=111,222,333
  const isAdminId = (id) => adminIds.includes(Number(id));

  bot.catch((err) => {
    console.error('[bot] error:', err.error ?? err);
  });

  const https = baseUrl.startsWith('https://');
  const orderUrl = `${baseUrl}/app/`;
  const pendingProof = new Map(); // adminId -> appId (ждём скриншот чека)

  /* Ссылку паре показываем без «https://» — короче и читается как адрес:
     nvate.uz/aziz-nilufar. Telegram сам делает её кликабельной. */
  const showLink = (url) => String(url).replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  /* Кто заходил в бот. Пишем мимоходом: ошибка записи не должна мешать ответу. */
  const seen = (ctx, lang = null) => {
    const from = ctx.from;
    if (!from?.id) return;
    touchUser({ id: from.id, username: from.username ?? null, firstName: from.first_name ?? null, lang, source: 'bot' })
      .catch((e) => console.error('[bot] touchUser failed:', e.message ?? e));
  };
  // Любое касание бота заводит человека в статистике — не только /start.
  bot.use(async (ctx, next) => { seen(ctx); await next(); });

  // Меню после выбора языка: одна большая кнопка «Заказать» (Web App) + Support/FAQ.
  function welcomeMenu(lang, fromId) {
    const uz = lang === 'uz';
    const kb = new InlineKeyboard();
    if (https) kb.webApp(uz ? '💌 Buyurtma berish' : '💌 Заказать', orderUrl).row();
    if (SUPPORT_URL) kb.url(uz ? '💬 Yordam' : '💬 Поддержка', SUPPORT_URL);
    else kb.text(uz ? '💬 Yordam' : '💬 Поддержка', `support:${lang}`);
    kb.text('❔ FAQ', `faq:${lang}`).row();
    if (isAdminId(fromId) && https) kb.webApp('📊 Admin', `${baseUrl}/admin/`);
    return kb;
  }

  // /admin — панель только для админов. Не админ → бот молчит.
  bot.command('admin', async (ctx) => {
    if (!isAdminId(ctx.from?.id)) return;
    if (!https) {
      await ctx.reply(`⚠️ BASE_URL не HTTPS. Панель: ${baseUrl}/admin/`);
      return;
    }
    await ctx.reply('📊 Admin panel', {
      reply_markup: new InlineKeyboard().webApp('📊 Ochish · Открыть', `${baseUrl}/admin/`),
    });
  });

  // /start → выбор языка.
  bot.command(['start', 'menu'], async (ctx) => {
    seen(ctx);
    await ctx.reply(text('langPrompt'), {
      reply_markup: new InlineKeyboard().text('O‘zbekcha 🇺🇿', 'lang:uz').text('Русский 🇷🇺', 'lang:ru'),
    });
  });

  bot.callbackQuery(/^lang:(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1];
    seen(ctx, lang);
    await ctx.answerCallbackQuery();
    const extra = https ? '' : `\n\n⚠️ BASE_URL не HTTPS — форма: ${orderUrl}`;
    const opts = { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: welcomeMenu(lang, ctx.from?.id) };
    const welcome = textLang('welcome', lang) + extra;
    try { await ctx.editMessageText(welcome, opts); }
    catch { await ctx.reply(welcome, opts); }
  });

  bot.callbackQuery(/^faq:(uz|ru)$/, async (ctx) => {
    const uz = ctx.match[1] === 'uz';
    await ctx.answerCallbackQuery();
    const prices = publicTemplates().map((template) => template.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = minPrice === maxPrice ? money(minPrice) : `${money(minPrice)}–${money(maxPrice)}`;
    const body = textLang('faq', uz ? 'uz' : 'ru', {
      price: priceRange, guestPrice: money(GUEST_LINK_PRICE), photos: MAX_PHOTOS,
    });
    await ctx.reply(body, { parse_mode: 'HTML', reply_markup: welcomeMenu(uz ? 'uz' : 'ru', ctx.from?.id) });
  });

  bot.callbackQuery(/^support:(uz|ru)$/, async (ctx) => {
    const uz = ctx.match[1] === 'uz';
    await ctx.answerCallbackQuery();
    await ctx.reply(textLang('support', uz ? 'uz' : 'ru'), { parse_mode: 'HTML' });
  });

  // ── Оплата: подтверждаем ТОЛЬКО после скриншота чека ──
  bot.callbackQuery(/^paid:(\d+)$/, async (ctx) => {
    if (!isAdminId(ctx.from?.id)) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const id = Number(ctx.match[1]);
    pendingProof.set(ctx.from.id, id);
    await ctx.answerCallbackQuery({ text: '📸 Пришлите скриншот чека' });
    await ctx.reply(`📸 Заявка #${id}: пришлите скриншот оплаты одним фото.\nОтмена — /cancel`);
  });

  bot.callbackQuery(/^cancel:(\d+)$/, async (ctx) => {
    if (!isAdminId(ctx.from?.id)) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const id = Number(ctx.match[1]);
    try {
      const app = (await cancelApplication(id));
      const musicTitle = app.music_type === 'upload' ? await trackLabel(app.music_value) : null;
      await ctx.editMessageText(buildAdminText(app, { baseUrl, musicTitle }), {
        parse_mode: 'HTML', link_preview_options: { is_disabled: true },
      });
      await ctx.answerCallbackQuery({ text: 'Заявка отклонена' });
      try {
        await ctx.api.sendMessage(app.tg_user_id, textLang('cancelled', app.lang));
      } catch { /* пара могла заблокировать бота */ }
    } catch (e) {
      const reason = e instanceof ValidationError ? e.message : 'Ошибка, попробуйте ещё раз';
      if (!(e instanceof ValidationError)) console.error('[bot] cancel error:', e);
      await ctx.answerCallbackQuery({ text: reason, show_alert: true });
    }
  });

  bot.command('cancel', async (ctx) => {
    if (pendingProof.delete(ctx.from?.id)) await ctx.reply('Отменено. Заявка осталась в статусе «новая».');
  });

  // Скриншот от админа → сохраняем чек, подтверждаем заявку, уведомляем пару.
  bot.on('message:photo', async (ctx) => {
    const adminId = ctx.from?.id;
    if (!isAdminId(adminId)) return;
    const id = pendingProof.get(adminId);
    if (!id) { await ctx.reply('Нет заявки, ожидающей скриншот. Нажмите «✅ Оплачено» под нужной заявкой.'); return; }
    pendingProof.delete(adminId);
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const f = await ctx.api.getFile(photo.file_id);
      const buf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`)).arrayBuffer());
      const name = `proof-${id}-${randomUUID()}.jpg`;
      writeFileSync(path.join(UPLOADS_DIR, name), buf);
      const adminName = ctx.from.username ? '@' + ctx.from.username : (ctx.from.first_name || String(adminId));
      const { app, guests } = (await payApplication(id, { adminId, adminName, proof: name }));
      await ctx.reply(`✅ Заявка #${id} подтверждена (${adminName}). Чек сохранён.\n${baseUrl}/${app.slug}`, {
        link_preview_options: { is_disabled: true },
      });
      try {
        await notifyCouplePaid(ctx.api, app, guests);
      } catch (e) {
        console.error('[bot] notify couple failed:', e);
        await ctx.reply(`⚠️ Не удалось уведомить пару (id ${app.tg_user_id}). Ссылка: ${baseUrl}/${app.slug}`);
      }
    } catch (e) {
      const msg = e instanceof ValidationError ? e.message : 'Ошибка подтверждения, попробуйте ещё раз';
      if (!(e instanceof ValidationError)) console.error('[bot] proof confirm:', e);
      await ctx.reply('⚠️ ' + msg);
    }
  });

  /* ── Музыка: песню присылают боту ──
     Узбекская музыка живёт в Telegram-каналах: переслать трек сюда быстрее,
     чем искать его где-то ещё. Бот берёт всё, из чего можно достать песню:
     аудио и голосовые — как есть, из видео и кружков извлекает звук, ссылку на
     YouTube, TikTok, Instagram и т.п. разбирает сам. Готовая песня появляется в
     студии, в «Моей музыке», целиком — гости услышат песню, а не превью. */
  const AUDIO_DOC = /\.(mp3|m4a|ogg|oga|opus|wav)$/i;
  const VIDEO_DOC = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i;
  const IMPORT_ERRORS = {
    link: ['Havolani o‘qib bo‘lmadi.', 'Не получилось прочитать ссылку.'],
    unsupported: ['Bu saytdan musiqa olib bo‘lmaydi.', 'С этого сайта звук не достать.'],
    blocked: ['YouTube hozir yuklab olishga ruxsat bermadi. Keyinroq urinib ko‘ring yoki qo‘shiqning o‘zini yuboring.', 'YouTube сейчас не отдаёт звук. Попробуйте позже или пришлите саму песню.'],
    private: ['Video yopiq yoki kirishni talab qiladi.', 'Видео закрыто или требует входа.'],
    long: ['Video 15 daqiqadan uzun.', 'Видео длиннее 15 минут.'],
    big: ['Fayl juda katta.', 'Файл слишком большой.'],
    gone: ['Video topilmadi.', 'Видео не найдено.'],
    noaudio: ['Bu videoda ovoz yo‘q.', 'В этом видео нет звука.'],
    format: ['Bu faylni o‘qiy olmadik.', 'Не получилось прочитать этот файл.'],
    timeout: ['Juda uzoq davom etdi, yana urinib ko‘ring.', 'Слишком долго, попробуйте ещё раз.'],
    busy: ['Hozir navbat katta, birozdan keyin yuboring.', 'Сейчас очередь, пришлите чуть позже.'],
    unavailable: ['Import vaqtincha ishlamayapti.', 'Импорт временно недоступен.'],
    failed: ['Musiqani ajratib bo‘lmadi, yana urinib ko‘ring.', 'Не удалось достать музыку, попробуйте ещё раз.'],
  };

  const studioKeyboard = () => (https ? new InlineKeyboard().webApp('💌 Studiya · Студия', orderUrl) : undefined);
  const trackDone = (track) => text('musicDone', {
    title: esc(track.title),
    artist: track.artist ? ` — ${esc(track.artist)}` : '',
  });

  async function downloadMedia(ctx, media) {
    const file = await ctx.api.getFile(media.file_id);
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`download ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /* Извлечение идёт минутами, а бот обрабатывает сообщения по очереди — поэтому
     ждём его вне обработчика: сразу «достаём музыку», потом это же сообщение
     переписываем готовой песней или понятной причиной. */
  function importReply(ctx, replyTo, start) {
    (async () => {
      const wait = await ctx.reply(text('musicWait'), replyTo);
      let job = null;
      try {
        job = await start();
        if (job.status === 'queued' || job.status === 'working') job = await waitForImport(job.id);
      } catch (e) {
        job = { status: 'error', error: e.code || 'failed' };
        if (!e.code) console.error('[bot] import failed:', e.message ?? e);
      }
      const done = job?.status === 'done' && job.track;
      const [uz, ru] = IMPORT_ERRORS[job?.error] ?? IMPORT_ERRORS.failed;
      const body = done ? trackDone(job.track) : `⚠️ ${uz}\n⚠️ ${ru}`;
      const keyboard = done ? studioKeyboard() : undefined;
      const extra = { parse_mode: 'HTML', ...(keyboard ? { reply_markup: keyboard } : {}) };
      try {
        await ctx.api.editMessageText(ctx.chat.id, wait.message_id, body, extra);
      } catch {
        await ctx.reply(body, { ...extra, ...replyTo });
      }
    })().catch((e) => console.error('[bot] import reply failed:', e.message ?? e));
  }

  bot.on(['message:audio', 'message:voice', 'message:document', 'message:video', 'message:video_note', 'message:animation'], async (ctx, next) => {
    const msg = ctx.message;
    const media = msg.audio ?? msg.voice ?? msg.video ?? msg.video_note ?? msg.animation ?? msg.document;
    const mime = String(media.mime_type ?? '');
    const video = Boolean(msg.video || msg.video_note || msg.animation)
      || Boolean(msg.document && (mime.startsWith('video/') || VIDEO_DOC.test(media.file_name ?? '')));
    if (msg.document && !video && !mime.startsWith('audio/') && !AUDIO_DOC.test(media.file_name ?? '')) {
      return next();
    }
    const ownerId = ctx.from?.id;
    if (!ownerId) return;
    const replyTo = { reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } };
    if (media.file_size && media.file_size > MAX_TRACK_BYTES) {
      await ctx.reply(text('musicBig'), replyTo);
      return;
    }
    if (video) {
      const named = metaFromFileName(media.file_name ?? '');
      importReply(ctx, replyTo, async () => importVideo(ownerId, await downloadMedia(ctx, media), {
        title: named.title || String(msg.caption ?? '').slice(0, 120) || 'Video',
        artist: named.artist,
      }));
      return;
    }
    try {
      let track = await trackByTelegram(ownerId, media.file_unique_id);
      if (!track) {
        const named = metaFromFileName(media.file_name ?? '');
        const added = await addTrack(await downloadMedia(ctx, media), {
          ownerId,
          source: 'bot',
          tgUniqueId: media.file_unique_id,
          title: msg.voice ? 'Ovozli xabar · Голосовое' : (media.title || named.title || 'Musiqa'),
          artist: media.performer || named.artist,
          duration: media.duration,
        });
        if (!added) {
          await ctx.reply('⚠️ Bu formatni o‘qiy olmadik — MP3, M4A, OGG yoki WAV yuboring.\n⚠️ Не получилось прочитать формат — пришлите MP3, M4A, OGG или WAV.', replyTo);
          return;
        }
        track = added.track;
      }
      const keyboard = studioKeyboard();
      await ctx.reply(trackDone(track), { parse_mode: 'HTML', ...replyTo, ...(keyboard ? { reply_markup: keyboard } : {}) });
    } catch (e) {
      console.error('[bot] track receive failed:', e.message ?? e);
      await ctx.reply('⚠️ Qo‘shiqni yuklab bo‘lmadi, yana yuboring.\n⚠️ Не удалось сохранить песню, пришлите ещё раз.', replyTo);
    }
  });

  /* Ссылка на ролик или песню текстом: YouTube, TikTok, Instagram… Обычный текст
     и ссылки на прочие сайты идут дальше своим путём. */
  bot.on('message:text', async (ctx, next) => {
    const body = ctx.message.text ?? '';
    const link = body.match(/https?:\/\/\S+/i)?.[0];
    if (body.startsWith('/') || !link || siteOf(link) === 'web' || !ctx.from?.id) return next();
    const replyTo = { reply_parameters: { message_id: ctx.message.message_id, allow_sending_without_reply: true } };
    importReply(ctx, replyTo, () => importLink(ctx.from.id, body));
  });

  // Пара нажала «Поделиться» → помечаем отправленной, а через 2 секунды
  // переписываем сообщение: прямым текстом, что эта ссылка уже отправлена.
  bot.callbackQuery(/^sent:(\d+):(.+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    const app = (await getApplication(id));
    if (!app || Number(app.tg_user_id) !== Number(ctx.from?.id)) {
      return ctx.answerCallbackQuery({ text: 'Bu havola sizga tegishli emas · Эта ссылка не ваша', show_alert: true });
    }
    const token = ctx.match[2];
    const isMain = token === '_main' || token === 'm';
    const guests = isMain ? [] : (await listGuests(id));
    const guest = isMain
      ? null
      : /^g\d+$/.test(token)
        ? guests.find((item) => Number(item.id) === Number(token.slice(1)))
        : guests.find((item) => item.slug === token);
    if (!isMain && !guest) return ctx.answerCallbackQuery({ text: 'Havola topilmadi · Ссылка не найдена', show_alert: true });
    if (isMain) (await markMainSent(id)); else (await markGuestSent(id, guest.slug));
    await ctx.answerCallbackQuery({ text: '✅' });

    const uz = app.lang !== 'ru';
    const link = isMain ? `${baseUrl}/${app.slug}` : `${baseUrl}/${app.slug}/${guest.slug}`;
    const guestName = guest?.name ?? '';

    const body = isMain
      ? `🔗 <b>${uz ? 'Umumiy havola' : 'Общая ссылка'}</b>\n${showLink(link)}\n\n${textLang('guestSent', app.lang)}`
      : `👤 <b>${esc(guestName)}</b>\n🔗 ${showLink(link)}\n\n${textLang('guestSent', app.lang)}`;

    setTimeout(async () => {
      try {
        await ctx.editMessageText(body, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: [] },
        });
      } catch { /* сообщение уже изменено или слишком старое */ }
    }, 2000);
  });
  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

  /* ── Инлайн-режим: сама отправка приглашения ──
     «Поделиться» открывает выбор чата и подставляет «@nvate_bot inv slug»; бот
     отвечает карточкой приглашения, пара жмёт её — и сообщение ушло. Именная
     кнопка («g id») срабатывает один раз: как только пара выбрала чат, кнопку в
     её сообщении снимаем и помечаем ссылку отправленной. */
  function guestInvite(app, name) {
    return app.lang === 'ru'
      ? `💌 ${name}, ${app.groom_name} и ${app.bride_name} приглашают вас на свадьбу`
      : `💌 Hurmatli ${name}! ${app.groom_name} va ${app.bride_name} sizni to‘yga taklif qiladi`;
  }

  function inviteResult(app, link, guest = null) {
    const uz = app.lang !== 'ru';
    const couple = `${esc(app.groom_name)} &amp; ${esc(app.bride_name)}`;
    const when = `📅 ${weddingDate(app)}  ·  🕰 ${esc(app.wedding_time)}`;
    const where = app.address ? `\n📍 ${esc(app.address)}` : '';
    const vars = { couple, when, where, link: showLink(link), name: guest ? esc(guest.name) : '' };
    const body = guest ? textLang('inviteGuest', app.lang, vars) : textLang('invite', app.lang, vars);
    const couplePlain = `${app.groom_name} & ${app.bride_name}`;
    return {
      type: 'article',
      id: guest ? `g-${guest.id}` : `m-${app.id}`,
      title: guest
        ? (uz ? `💌 ${guest.name} uchun taklifnoma` : `💌 Приглашение: ${guest.name}`)
        : (uz ? `💌 ${couplePlain} — taklifnoma` : `💌 ${couplePlain} — приглашение`),
      description: `${weddingDate(app)} · ${showLink(link)}`,
      input_message_content: {
        message_text: body,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      },
      reply_markup: new InlineKeyboard().url(uz ? '💌 Taklifnomani ochish' : '💌 Открыть приглашение', link),
    };
  }

  async function consumeGuestButton(api, app, guest) {
    if (Number(guest.sent)) return;
    await markGuestSent(app.id, guest.slug);
    if (!guest.message_id) return;
    try {
      await api.editMessageText(app.tg_user_id, Number(guest.message_id),
        `${guestCard(app, guest)}\n\n${textLang('guestSent', app.lang)}`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [] } });
    } catch { /* сообщение удалено или уже изменено */ }
  }

  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const main = /^inv\s+([a-z0-9-]{1,120})$/i.exec(query);
    const named = /^g\s+(\d{1,12})$/.exec(query);
    try {
      if (main) {
        const app = await getApplicationBySlug(main[1].toLowerCase());
        if (!app) return await ctx.answerInlineQuery([], { cache_time: 10 });
        return await ctx.answerInlineQuery([inviteResult(app, `${baseUrl}/${app.slug}`)], { cache_time: 60 });
      }
      if (named) {
        const guest = await getGuestById(Number(named[1]));
        const app = guest ? await getApplication(guest.application_id) : null;
        // Именную ссылку отправляет только сама пара.
        if (!guest || !app?.slug || app.status !== 'paid' || Number(app.tg_user_id) !== Number(ctx.from.id)) {
          return await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
        }
        await consumeGuestButton(ctx.api, app, guest);
        return await ctx.answerInlineQuery([inviteResult(app, `${baseUrl}/${app.slug}/${guest.slug}`, guest)], { cache_time: 0, is_personal: true });
      }
      await ctx.answerInlineQuery([], { cache_time: 300 });
    } catch (e) {
      console.error('[bot] inline query failed:', e.message ?? e);
    }
  });

  /* Выбор чата уже снял кнопку; это — подтверждение, что приглашение
     действительно ушло. Повторная отметка ничего не меняет. */
  bot.on('chosen_inline_result', async (ctx) => {
    const id = /^g-(\d+)$/.exec(ctx.chosenInlineResult.result_id ?? '')?.[1];
    if (!id) return;
    try {
      const guest = await getGuestById(Number(id));
      const app = guest ? await getApplication(guest.application_id) : null;
      if (guest && app && Number(app.tg_user_id) === Number(ctx.from.id)) await consumeGuestButton(ctx.api, app, guest);
    } catch (e) {
      console.error('[bot] chosen inline result failed:', e.message ?? e);
    }
  });

  // Прочие сообщения: подсказка chat id, пока ADMIN_CHAT_IDS не настроен.
  bot.on('message', async (ctx) => {
    if (!adminIds.length) {
      await ctx.reply(
        `Ваш chat id: <code>${ctx.chat.id}</code>\nДобавьте его в .env: ADMIN_CHAT_IDS=id1,id2 — и перезапустите сервер.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  /* ── Готовое приглашение: что получает пара ──
     Сначала карточка с QR-кодом — её сканируют с экрана или печатают на столы.
     Затем общая ссылка с кнопкой «Поделиться»: жми сколько угодно раз, отправляй
     кому угодно. В конце — именные ссылки: у каждой кнопка одноразовая и
     исчезает, как только приглашение ушло гостю.
     Кнопки работают через инлайн-режим бота (@BotFather → /setinline). Пока он
     выключен, остаётся обычная ссылка «поделиться» — рабочая, но многоразовая. */
  const inlineShare = () => {
    try { return Boolean(bot.botInfo?.supports_inline_queries); } catch { return false; }
  };
  const shareLink = (link, caption) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(caption)}`;
  const guestLink = (app, guest) => `${baseUrl}/${app.slug}/${guest.slug}`;
  // Сначала имя, потом адрес — и адрес без «https://».
  const guestCard = (app, guest) => text('guestCard', {
    name: esc(guest.name), link: showLink(guestLink(app, guest)),
  });

  /* Совместимость: кнопка «Отправить · Имя» из рассылок, сделанных до перехода
     на одно нажатие. В новых сообщениях её нет — там выбор чата открывается
     сразу, — но уже отправленные кнопки обязаны продолжать работать. */
  bot.callbackQuery(/^share:(\d+)$/, async (ctx) => {
    const guest = await getGuestById(Number(ctx.match[1]));
    const app = guest ? await getApplication(guest.application_id) : null;
    if (!guest || !app?.slug || Number(app.tg_user_id) !== Number(ctx.from?.id)) {
      return ctx.answerCallbackQuery({ text: 'Havola topilmadi · Ссылка не найдена', show_alert: true });
    }
    await ctx.answerCallbackQuery({ text: '✅' });
    const link = guestLink(app, guest);
    if (!Number(guest.sent)) {
      await markGuestSent(app.id, guest.slug);
      try {
        await ctx.editMessageText(`${guestCard(app, guest)}\n\n${textLang('guestSent', app.lang)}`,
          { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [] } });
      } catch { /* сообщение уже изменено */ }
    }
    const uz = app.lang !== 'ru';
    await ctx.reply(guestCard(app, guest), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: new InlineKeyboard()
        .url(uz ? '📤 Ulashish' : '📤 Поделиться', shareLink(link, guestInvite(app, guest.name))),
    });
  });

  async function notifyCouplePaid(api, app) {
    const uz = app.lang !== 'ru';
    const chat = app.tg_user_id;
    const link = `${baseUrl}/${app.slug}`;
    const couple = `${esc(app.groom_name)} &amp; ${esc(app.bride_name)}`;
    const when = `📅 ${weddingDate(app)}  ·  🕰 ${esc(app.wedding_time)}`;
    const where = app.address ? `\n📍 ${esc(app.address)}` : '';
    const quiet = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

    try {
      await api.sendPhoto(chat, new InputFile(renderShareCard(link), `nvate-${app.slug}.png`), {
        parse_mode: 'HTML',
        caption: textLang('paidCard', app.lang, { couple, when, where }),
      });
    } catch (e) {
      // Без карточки пара всё равно получает ссылки ниже.
      console.error('[bot] QR card failed:', e.message ?? e);
    }

    const invite = uz
      ? `💌 ${app.groom_name} va ${app.bride_name} to‘yiga taklifnoma`
      : `💌 Приглашение на свадьбу: ${app.groom_name} и ${app.bride_name}`;
    const main = new InlineKeyboard();
    if (inlineShare()) main.switchInline(uz ? '📤 Ulashish' : '📤 Поделиться', `inv ${app.slug}`);
    else main.url(uz ? '📤 Ulashish' : '📤 Поделиться', shareLink(link, invite));
    main.row().url(uz ? '💌 Taklifnomani ochish' : '💌 Открыть приглашение', link);
    await api.sendMessage(chat, textLang('mainLink', app.lang, { link: showLink(link) }),
      { ...quiet, reply_markup: main });

    const guests = await listGuests(app.id);
    if (!guests.length) return;
    await api.sendMessage(chat, textLang('guestsIntro', app.lang, { count: guests.length }), { parse_mode: 'HTML' });
    /* Одно нажатие на гостя. Раньше без инлайн-режима кнопка вела в бота: он
       присылал ещё одно сообщение, и только там была «Поделиться» — два
       нажатия и лишняя переписка на каждого гостя. Теперь выбор чата
       открывается сразу: инлайн-кнопкой, если режим включён у бота, иначе
       ссылкой t.me/share — её Telegram открывает своим окном выбора.
       Отметку «отправлено» ставит инлайн-режим (его гасит выбор чата);
       у ссылки обратного сигнала нет, поэтому кнопка остаётся рабочей. */
    const inline = inlineShare();
    for (const guest of guests) {
      const name = String(guest.name).slice(0, 32);
      const label = uz ? `📤 Ulashish · ${name}` : `📤 Поделиться · ${name}`;
      const keyboard = inline
        ? new InlineKeyboard().switchInline(label, `g ${guest.id}`)
        : new InlineKeyboard().url(label, shareLink(guestLink(app, guest), guestInvite(app, guest.name)));
      const sent = await api.sendMessage(chat, guestCard(app, guest), { ...quiet, reply_markup: keyboard });
      if (inline) await setGuestMessage(guest.id, sent.message_id);
    }
  }

  // Тем же сообщением пара получает ссылку, если оплату подтвердили из
  // админ-панели, а не кнопкой в боте.
  bot.notifyCouplePaid = (app, guests) => notifyCouplePaid(bot.api, app, guests);

  return bot;
}

// Вызывается сервером после создания заявки.
export async function notifyNewApplication(api, adminIds, app, baseUrl) {
  const ids = Array.isArray(adminIds) ? adminIds : [adminIds].filter(Boolean);
  if (!ids.length) {
    console.warn('[bot] ADMIN_CHAT_IDS не настроен — уведомление о заявке не отправлено');
    return;
  }
  const musicTitle = app.music_type === 'upload' ? await trackLabel(app.music_value) : null;
  const card = buildAdminText(app, { baseUrl, musicTitle });
  const opts = {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: new InlineKeyboard()
      .text('✅ Оплачено', `paid:${app.id}`)
      .text('❌ Отклонить', `cancel:${app.id}`),
  };
  // Заявка уходит всем админам — подтвердить может любой.
  for (const id of ids) {
    try {
      await api.sendMessage(id, card, opts);
    } catch (e) {
      console.error(`[bot] не удалось уведомить админа ${id}:`, e.message ?? e);
    }
  }
}
