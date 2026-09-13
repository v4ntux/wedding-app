import { Bot, InlineKeyboard } from 'grammy';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { payApplication, cancelApplication, ValidationError, mapsLinks } from './service.js';
import { findMusicPreset, SUPPORT_URL, ADDONS, GUEST_LINK_PRICE, MAX_PHOTOS } from './config.js';
import { findTemplate, publicTemplates } from './templateStore.js';
import { markMainSent, markGuestSent, getApplication, listGuests, refreshSettings, getTrack, setTrackLibrary, trackByTelegram } from './db.js';
import { UPLOADS_DIR } from './upload.js';
import { escapeHtml as esc } from './render.js';
import { addTrack, metaFromFileName, trackLabel, MAX_TRACK_BYTES } from './music.js';

function money(n) {
  return `${Number(n).toLocaleString('ru-RU')} сум`;
}

function musicLine(app, musicTitle = null) {
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
    `🎵 ${esc(musicLine(app, musicTitle))}${app.music_start > 0 ? ` (с ${Math.floor(app.music_start / 60)}:${String(Math.round(app.music_start % 60)).padStart(2, '0')})` : ''}`,
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

  const WELCOME = {
    uz:
      '✨ <b>nvate</b> — onlayn taklifnomalar\n\n' +
      'Bu bot orqali siz:\n' +
      '• To‘y uchun chiroyli onlayn taklifnoma yaratasiz\n' +
      '• Sana, manzil (jonli xarita), musiqa va suratlar qo‘shasiz\n' +
      '• Har bir mehmonga alohida nomli havola olasiz\n\n' +
      'Boshlash uchun quyidagi tugmani bosing 👇',
    ru:
      '✨ <b>nvate</b> — онлайн приглашения\n\n' +
      'С помощью этого бота вы:\n' +
      '• Создадите красивое онлайн-приглашение на свадьбу\n' +
      '• Добавите дату, локацию (живая карта), музыку и фото\n' +
      '• Получите личную ссылку для каждого гостя\n\n' +
      'Нажмите кнопку ниже, чтобы начать 👇',
  };

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
    await ctx.reply('🇺🇿 Tilni tanlang · 🇷🇺 Выберите язык', {
      reply_markup: new InlineKeyboard().text('O‘zbekcha 🇺🇿', 'lang:uz').text('Русский 🇷🇺', 'lang:ru'),
    });
  });

  bot.callbackQuery(/^lang:(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1];
    await ctx.answerCallbackQuery();
    const extra = https ? '' : `\n\n⚠️ BASE_URL не HTTPS — форма: ${orderUrl}`;
    const opts = { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: welcomeMenu(lang, ctx.from?.id) };
    try { await ctx.editMessageText(WELCOME[lang] + extra, opts); }
    catch { await ctx.reply(WELCOME[lang] + extra, opts); }
  });

  bot.callbackQuery(/^faq:(uz|ru)$/, async (ctx) => {
    const uz = ctx.match[1] === 'uz';
    await ctx.answerCallbackQuery();
    const prices = publicTemplates().map((template) => template.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = minPrice === maxPrice ? money(minPrice) : `${money(minPrice)}–${money(maxPrice)}`;
    const guestPrice = money(GUEST_LINK_PRICE);
    const text = uz
      ? '<b>❔ Ko‘p so‘raladigan savollar</b>\n\n' +
        `💰 <b>Narx:</b> shablonga qarab ${priceRange}. Nomli havola — har bir mehmon uchun ${guestPrice}.\n` +
        '🔗 <b>Havola:</b> to‘lovdan so‘ng shaxsiy havola beriladi va o‘chirilmaydi.\n' +
        '🎵 <b>Musiqa:</b> qo‘shiqni shu botga yuboring yoki kutubxonadan tanlang — to‘liq yangraydi.\n' +
        `📷 <b>Suratlar:</b> 1–${MAX_PHOTOS} ta.\n` +
        '⏱ <b>Vaqt:</b> to‘ldirish ~5 daqiqa.'
      : '<b>❔ Частые вопросы</b>\n\n' +
        `💰 <b>Цена:</b> ${priceRange} в зависимости от шаблона. Именная ссылка — ${guestPrice} за гостя.\n` +
        '🔗 <b>Ссылка:</b> выдаётся после оплаты и не удаляется.\n' +
        '🎵 <b>Музыка:</b> пришлите песню этому боту или выберите из библиотеки — звучит целиком.\n' +
        `📷 <b>Фото:</b> 1–${MAX_PHOTOS} шт.\n` +
        '⏱ <b>Время:</b> заполнение ~5 минут.';
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: welcomeMenu(uz ? 'uz' : 'ru', ctx.from?.id) });
  });

  bot.callbackQuery(/^support:(uz|ru)$/, async (ctx) => {
    const uz = ctx.match[1] === 'uz';
    await ctx.answerCallbackQuery();
    await ctx.reply(
      uz
        ? '💬 <b>Yordam</b>\n\nSavolingizni shu yerga yozing — tez orada javob beramiz.'
        : '💬 <b>Поддержка</b>\n\nНапишите ваш вопрос сюда — ответим в ближайшее время.',
      { parse_mode: 'HTML' }
    );
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
        await ctx.api.sendMessage(app.tg_user_id, app.lang === 'ru'
          ? 'К сожалению, ваша заявка отклонена. Свяжитесь с поддержкой для уточнения.'
          : 'Afsuski, arizangiz rad etildi. Aniqlik uchun yordam xizmatiga yozing.');
      } catch { /* пара могла заблокировать бота */ }
    } catch (e) {
      const text = e instanceof ValidationError ? e.message : 'Ошибка, попробуйте ещё раз';
      if (!(e instanceof ValidationError)) console.error('[bot] cancel error:', e);
      await ctx.answerCallbackQuery({ text, show_alert: true });
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
     чем искать его где-то ещё. Файл уходит в студию целиком — гости услышат
     песню, а не тридцать секунд превью. Админ под треком видит кнопку
     «в библиотеку»: полка nvate собирается из того, что пары несут сами. */
  const AUDIO_DOC = /\.(mp3|m4a|ogg|oga|opus|wav)$/i;

  function trackKeyboard(track, fromId) {
    const kb = new InlineKeyboard();
    if (https) kb.webApp('💌 Studiya · Студия', orderUrl);
    if (isAdminId(fromId)) {
      if (https) kb.row();
      kb.text(Number(track.library) ? '✅ Kutubxonada · В библиотеке' : '📚 Kutubxonaga · В библиотеку', `lib:${track.id}`);
    }
    return kb;
  }

  bot.on(['message:audio', 'message:voice', 'message:document'], async (ctx, next) => {
    const msg = ctx.message;
    const media = msg.audio ?? msg.voice ?? msg.document;
    if (msg.document && !String(media.mime_type ?? '').startsWith('audio/') && !AUDIO_DOC.test(media.file_name ?? '')) {
      return next();
    }
    const ownerId = ctx.from?.id;
    if (!ownerId) return;
    const replyTo = { reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } };
    if (media.file_size && media.file_size > MAX_TRACK_BYTES) {
      await ctx.reply('⚠️ Fayl 20 MB dan katta — Telegram bunday fayllarni botlarga bermaydi.\n⚠️ Файл больше 20 МБ — Telegram не отдаёт такие ботам.', replyTo);
      return;
    }
    try {
      let track = await trackByTelegram(ownerId, media.file_unique_id);
      if (!track) {
        const named = metaFromFileName(media.file_name ?? '');
        const file = await ctx.api.getFile(media.file_id);
        const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(90_000) });
        if (!response.ok) throw new Error(`download ${response.status}`);
        const added = await addTrack(Buffer.from(await response.arrayBuffer()), {
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
      const name = `🎵 <b>${esc(track.title)}</b>${track.artist ? ` — ${esc(track.artist)}` : ''}`;
      await ctx.reply(
        `${name}\n\n✅ Studiyada: <i>Musiqa → Mening musiqam</i>\n✅ В студии: <i>Музыка → Моя музыка</i>`,
        { parse_mode: 'HTML', ...replyTo, reply_markup: trackKeyboard(track, ownerId) }
      );
    } catch (e) {
      console.error('[bot] track receive failed:', e.message ?? e);
      await ctx.reply('⚠️ Qo‘shiqni yuklab bo‘lmadi, yana yuboring.\n⚠️ Не удалось сохранить песню, пришлите ещё раз.', replyTo);
    }
  });

  // Кнопка админа: на полку и обратно — ошибку можно тут же исправить.
  bot.callbackQuery(/^lib:(\d+)$/, async (ctx) => {
    if (!isAdminId(ctx.from?.id)) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const track = await getTrack(Number(ctx.match[1]));
    if (!track) return ctx.answerCallbackQuery({ text: 'Трек не найден', show_alert: true });
    const on = !Number(track.library);
    await setTrackLibrary(track.id, on);
    await ctx.answerCallbackQuery({ text: on ? '📚 На полке nvate' : 'Снят с полки' });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: trackKeyboard({ ...track, library: on ? 1 : 0 }, ctx.from.id) });
    } catch { /* сообщение уже изменено */ }
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

    const text = isMain
      ? (uz
        ? `🔗 <b>Umumiy havola:</b>\n${link}\n\n✅ <b>Yuborildi</b> — bu havola allaqachon yuborilgan.`
        : `🔗 <b>Общая ссылка:</b>\n${link}\n\n✅ <b>Отправлено</b> — эта ссылка уже отправлена.`)
      : (uz
        ? `<b>${esc(guestName)}</b>\n${link}\n\n✅ <b>Yuborildi</b> — bu havola allaqachon yuborilgan.`
        : `<b>${esc(guestName)}</b>\n${link}\n\n✅ <b>Отправлено</b> — эта ссылка уже отправлена.`);

    setTimeout(async () => {
      try {
        await ctx.editMessageText(text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: [] },
        });
      } catch { /* сообщение уже изменено или слишком старое */ }
    }, 2000);
  });
  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

  // Прочие сообщения: подсказка chat id, пока ADMIN_CHAT_IDS не настроен.
  bot.on('message', async (ctx) => {
    if (!adminIds.length) {
      await ctx.reply(
        `Ваш chat id: <code>${ctx.chat.id}</code>\nДобавьте его в .env: ADMIN_CHAT_IDS=id1,id2 — и перезапустите сервер.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // Уведомление пары после подтверждения: общая ссылка + именные ссылки с кнопкой «Отправить».
  async function notifyCouplePaid(api, app, guests) {
    const uz = app.lang !== 'ru';
    const link = `${baseUrl}/${app.slug}`;

    // Одна кнопка: нажал → ссылка помечается отправленной, а через 2 секунды
    // сообщение переписывается и прямо говорит, что она уже отправлена.
    const shareBtn = (cbData) =>
      new InlineKeyboard().text(uz ? '📤 Ulashish' : '📤 Поделиться', cbData);

    await api.sendMessage(app.tg_user_id,
      uz
        ? `🎉 Tabriklaymiz! Taklifnomangiz tayyor.\n\n🔗 <b>Umumiy havola:</b>\n${link}`
        : `🎉 Поздравляем! Ваше приглашение готово.\n\n🔗 <b>Общая ссылка:</b>\n${link}`,
      {
        parse_mode: 'HTML', link_preview_options: { is_disabled: true },
        reply_markup: app.main_sent
          ? new InlineKeyboard().text('✅ Yuborildi · Отправлено', 'noop')
          : shareBtn(`sent:${app.id}:m`),
      });

    if (guests.length) {
      await api.sendMessage(app.tg_user_id, uz
        ? '👥 Har bir mehmon uchun shaxsiy havola:'
        : '👥 Личная ссылка для каждого гостя:');
      for (const g of guests) {
        const glink = `${baseUrl}/${app.slug}/${g.slug}`;
        await api.sendMessage(app.tg_user_id,
          `<b>${esc(g.name)}</b>\n${glink}`, {
            parse_mode: 'HTML', link_preview_options: { is_disabled: true },
            reply_markup: shareBtn(`sent:${app.id}:g${g.id}`),
          });
      }
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
  const text = buildAdminText(app, { baseUrl, musicTitle });
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
      await api.sendMessage(id, text, opts);
    } catch (e) {
      console.error(`[bot] не удалось уведомить админа ${id}:`, e.message ?? e);
    }
  }
}
