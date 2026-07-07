import { Bot, InlineKeyboard } from 'grammy';
import { payApplication, cancelApplication, ValidationError, mapsLinks } from './service.js';
import { findTemplate, findMusicPreset } from './config.js';
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
  if (app.phone) lines.push(`📞 ${esc(app.phone)}`);

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

  bot.command('start', async (ctx) => {
    const text =
      '💍 Ассалому алайкум!\n\n' +
      'Здесь вы можете создать красивое свадебное приглашение (taklifnoma) со своей персональной ссылкой.\n\n' +
      'Нажмите кнопку ниже, заполните данные — и мы свяжемся с вами.';
    if (baseUrl.startsWith('https://')) {
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().webApp('💌 Создать приглашение', `${baseUrl}/app/`),
      });
    } else {
      // Web App кнопки требуют HTTPS — в dev-режиме даём обычную ссылку текстом.
      await ctx.reply(`${text}\n\n⚠️ BASE_URL не HTTPS, Web App кнопка недоступна.\nФорма: ${baseUrl}/app/`);
    }
  });

  // Пока ADMIN_CHAT_ID не настроен — подсказываем id любому написавшему.
  bot.on('message', async (ctx) => {
    if (!adminChatId) {
      await ctx.reply(
        `Ваш chat id: <code>${ctx.chat.id}</code>\n` +
          'Если вы администратор — пропишите его в .env как ADMIN_CHAT_ID и перезапустите сервер.',
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.callbackQuery(/^(paid|cancel):(\d+)$/, async (ctx) => {
    if (!adminChatId || ctx.from.id !== adminChatId) {
      return ctx.answerCallbackQuery({ text: 'Только для администратора', show_alert: true });
    }
    const action = ctx.match[1];
    const id = Number(ctx.match[2]);
    try {
      if (action === 'paid') {
        const { app, guests } = payApplication(id);
        await ctx.editMessageText(buildAdminText(app, { baseUrl, guests }), {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        await ctx.answerCallbackQuery({ text: '✅ Приглашение создано' });
        try {
          await ctx.api.sendMessage(app.tg_user_id, buildCoupleText(app, guests, baseUrl), {
            link_preview_options: { is_disabled: true },
          });
        } catch (e) {
          console.error('[bot] failed to notify couple:', e);
          await ctx.api.sendMessage(
            adminChatId,
            `⚠️ Не удалось отправить ссылку паре (id ${app.tg_user_id}). Отправьте вручную:\n${baseUrl}/${app.slug}`
          );
        }
      } else {
        const app = cancelApplication(id);
        await ctx.editMessageText(buildAdminText(app, { baseUrl }), {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        await ctx.answerCallbackQuery({ text: 'Заявка отклонена' });
        try {
          await ctx.api.sendMessage(
            app.tg_user_id,
            'К сожалению, ваша заявка отклонена. Свяжитесь с администратором для уточнения.'
          );
        } catch {
          /* пара могла заблокировать бота — не критично */
        }
      }
    } catch (e) {
      const text = e instanceof ValidationError ? e.message : 'Ошибка, попробуйте ещё раз';
      if (!(e instanceof ValidationError)) console.error('[bot] callback error:', e);
      await ctx.answerCallbackQuery({ text, show_alert: true });
    }
  });

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
