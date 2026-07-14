import { Bot, InlineKeyboard } from 'grammy';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { payApplication, cancelApplication, ValidationError, mapsLinks } from './service.js';
import { findMusicPreset, SUPPORT_URL } from './config.js';
import { findTemplate } from './templateStore.js';
import { markMainSent, markGuestSent } from './db.js';
import { UPLOADS_DIR } from './upload.js';
import { escapeHtml as esc } from './render.js';

function money(n) {
  return `${Number(n).toLocaleString('ru-RU')} сум`;
}

function musicLine(app) {
  if (app.music_type === 'preset') return findMusicPreset(app.music_value)?.name ?? app.music_value;
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

export function buildAdminText(app, { baseUrl, guests = [] } = {}) {
  const links = mapsLinks(app.lat, app.lng);
  const template = findTemplate(app.template_id);
  const lines = [
    `${STATUS_LINE[app.status] ?? app.status} — заявка #${app.id}`,
    '',
    `🤵 Жених: <b>${esc(app.groom_name)}</b>`,
    `👰 Невеста: <b>${esc(app.bride_name)}</b>`,
    `📅 ${esc(app.wedding_date)}  🕐 ${esc(app.wedding_time)}`,
    `📍 ${esc(app.address ?? 'адрес не указан')}`,
    `<a href="${links.google}">Google Maps</a> | <a href="${links.yandex}">Yandex Maps</a>`,
    `🎵 ${esc(musicLine(app))}`,
    `📷 Фото: ${photoCount(app)} шт.`,
    `🎨 Шаблон: ${esc(template?.name ?? app.template_id)} — ${money(app.template_price)}`,
  ];
  if (app.premium) {
    const count = JSON.parse(app.guest_names ?? '[]').length;
    lines.push(`⭐ Именные приглашения: ${count} гостей (+${money(app.premium_price)})`);
  }
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

export function createBot({ token, adminChatId, baseUrl }) {
  const bot = new Bot(token);

  bot.catch((err) => {
    console.error('[bot] error:', err.error ?? err);
  });

  const https = baseUrl.startsWith('https://');
  const orderUrl = `${baseUrl}/app/`;
  const pendingProof = new Map(); // adminId -> appId (ждём скриншот чека)

  const WELCOME = {
    uz:
      '✨ <b>nvate</b> — raqamli taklifnomalar\n\n' +
      'Bu bot orqali siz:\n' +
      '• To‘y, tug‘ilgan kun va boshqa tantanalar uchun chiroyli taklifnoma yaratasiz\n' +
      '• Sana, manzil (jonli xarita), musiqa va suratlar qo‘shasiz\n' +
      '• Har bir mehmonga alohida nomli havola olasiz\n\n' +
      'Boshlash uchun pastdagi katta tugmani bosing 👇',
    ru:
      '✨ <b>nvate</b> — цифровые приглашения\n\n' +
      'С помощью этого бота вы:\n' +
      '• Создадите красивое приглашение на свадьбу, день рождения и другие торжества\n' +
      '• Добавите дату, локацию (живая карта), музыку и фото\n' +
      '• Получите личную ссылку для каждого гостя\n\n' +
      'Нажмите большую кнопку ниже, чтобы начать 👇',
  };

  // Меню после выбора языка: одна большая кнопка «Заказать» (Web App) + Support/FAQ.
  function welcomeMenu(lang, fromId) {
    const uz = lang === 'uz';
    const kb = new InlineKeyboard();
    if (https) kb.webApp(uz ? '💌 Buyurtma berish' : '💌 Заказать', orderUrl).row();
    if (SUPPORT_URL) kb.url(uz ? '💬 Yordam' : '💬 Поддержка', SUPPORT_URL);
    else kb.text(uz ? '💬 Yordam' : '💬 Поддержка', `support:${lang}`);
    kb.text('❔ FAQ', `faq:${lang}`).row();
    if (adminChatId && fromId === adminChatId && https) kb.webApp('📊 Admin', `${baseUrl}/admin/`);
    return kb;
  }

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
    const text = uz
      ? '<b>❔ Ko‘p so‘raladigan savollar</b>\n\n' +
        '💰 <b>Narx:</b> shablonga qarab 129 000–199 000 so‘m. Nomli havola — har bir mehmon uchun 8 000 so‘m.\n' +
        '🔗 <b>Havola:</b> to‘lovdan so‘ng shaxsiy havola beriladi va o‘chirilmaydi.\n' +
        '🎵 <b>Musiqa:</b> katalog, YouTube yoki o‘z faylingiz.\n' +
        '📷 <b>Suratlar:</b> 1–6 ta.\n' +
        '⏱ <b>Vaqt:</b> to‘ldirish ~5 daqiqa.'
      : '<b>❔ Частые вопросы</b>\n\n' +
        '💰 <b>Цена:</b> 129 000–199 000 сум в зависимости от шаблона. Именная ссылка — 8 000 сум за гостя.\n' +
        '🔗 <b>Ссылка:</b> выдаётся после оплаты и не удаляется.\n' +
        '🎵 <b>Музыка:</b> каталог, YouTube или свой файл.\n' +
        '📷 <b>Фото:</b> 1–6 шт.\n' +
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
    if (!adminChatId || ctx.from.id !== adminChatId) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const id = Number(ctx.match[1]);
    pendingProof.set(ctx.from.id, id);
    await ctx.answerCallbackQuery({ text: '📸 Пришлите скриншот чека' });
    await ctx.reply(`📸 Заявка #${id}: пришлите скриншот оплаты одним фото.\nОтмена — /cancel`);
  });

  bot.callbackQuery(/^cancel:(\d+)$/, async (ctx) => {
    if (!adminChatId || ctx.from.id !== adminChatId) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const id = Number(ctx.match[1]);
    try {
      const app = cancelApplication(id);
      await ctx.editMessageText(buildAdminText(app, { baseUrl }), {
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
    if (!adminChatId || adminId !== adminChatId) return;
    const id = pendingProof.get(adminId);
    if (!id) { await ctx.reply('Нет заявки, ожидающей скриншот. Нажмите «✅ Оплачено» под нужной заявкой.'); return; }
    pendingProof.delete(adminId);
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const f = await ctx.api.getFile(photo.file_id);
      const buf = Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${token}/${f.file_path}`)).arrayBuffer());
      const name = `proof-${id}-${Date.now()}.jpg`;
      writeFileSync(path.join(UPLOADS_DIR, name), buf);
      const adminName = ctx.from.username ? '@' + ctx.from.username : (ctx.from.first_name || String(adminId));
      const { app, guests } = payApplication(id, { adminId, adminName, proof: name });
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

  // Пара делится ссылкой → отмечаем отправленной, кнопка становится зелёной.
  bot.callbackQuery(/^sent:(\d+):(.+)$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    const slug = ctx.match[2];
    if (slug === '_main') markMainSent(id); else markGuestSent(id, slug);
    await ctx.answerCallbackQuery({ text: '✅ Yuborildi · Отправлено' });
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard().text('✅ Yuborildi · Отправлено', 'noop'),
      });
    } catch { /* уже отредактировано */ }
  });
  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

  // Прочие сообщения: подсказка chat id, пока ADMIN_CHAT_ID не настроен.
  bot.on('message', async (ctx) => {
    if (!adminChatId) {
      await ctx.reply(
        `Ваш chat id: <code>${ctx.chat.id}</code>\nПропишите его в .env как ADMIN_CHAT_ID и перезапустите сервер.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // Уведомление пары после подтверждения: общая ссылка + именные ссылки с кнопкой «Отправить».
  async function notifyCouplePaid(api, app, guests) {
    const uz = app.lang !== 'ru';
    const link = `${baseUrl}/${app.slug}`;
    await api.sendMessage(app.tg_user_id,
      uz
        ? `🎉 Tabriklaymiz! Taklifnomangiz tayyor.\n\n🔗 <b>Umumiy havola:</b>\n${link}`
        : `🎉 Поздравляем! Ваше приглашение готово.\n\n🔗 <b>Общая ссылка:</b>\n${link}`,
      {
        parse_mode: 'HTML', link_preview_options: { is_disabled: true },
        reply_markup: app.main_sent
          ? new InlineKeyboard().text('✅ Yuborildi · Отправлено', 'noop')
          : new InlineKeyboard().text(uz ? '📤 Ulashish' : '📤 Поделиться', `sent:${app.id}:_main`),
      });
    if (guests.length) {
      await api.sendMessage(app.tg_user_id, uz
        ? '👥 Har bir mehmon uchun shaxsiy havola. «Yuborish»ni bosib, xabarni gostga ulashing:'
        : '👥 Личная ссылка для каждого гостя. Нажмите «Отправить» и перешлите сообщение гостю:');
      for (const g of guests) {
        await api.sendMessage(app.tg_user_id, `<b>${esc(g.name)}</b>\n${baseUrl}/${app.slug}/${g.slug}`, {
          parse_mode: 'HTML', link_preview_options: { is_disabled: true },
          reply_markup: new InlineKeyboard().text(uz ? '📤 Yuborish' : '📤 Отправить', `sent:${app.id}:${g.slug}`),
        });
      }
    }
  }

  return bot;
}

// Вызывается сервером после создания заявки.
export async function notifyNewApplication(api, adminChatId, app, baseUrl) {
  if (!adminChatId) {
    console.warn('[bot] ADMIN_CHAT_ID не настроен — уведомление о заявке не отправлено');
    return;
  }
  await api.sendMessage(adminChatId, buildAdminText(app, { baseUrl }), {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: new InlineKeyboard()
      .text('✅ Оплачено', `paid:${app.id}`)
      .text('❌ Отклонить', `cancel:${app.id}`),
  });
}
