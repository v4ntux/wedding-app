import { BOT_TOKEN, ADMIN_CHAT_IDS, BASE_URL, PORT, DEV_NO_AUTH, RUNTIME } from './config.js';
import { createBot, notifyNewApplication } from './bot.js';
import { createServer } from './server.js';
import { db } from './db.js';

if (!BOT_TOKEN && !DEV_NO_AUTH) {
  console.error(
    'Не задан BOT_TOKEN.\n' +
      '1) Создайте бота у @BotFather и получите токен\n' +
      '2) Скопируйте .env.example в .env и заполните BOT_TOKEN\n' +
      '(для разработки без Telegram можно запустить с DEV_NO_AUTH=1)'
  );
  process.exit(1);
}

let bot = null;
if (BOT_TOKEN) {
  bot = createBot({ token: BOT_TOKEN, adminIds: ADMIN_CHAT_IDS, baseUrl: BASE_URL });
}

const server = createServer({
  // Оплату подтвердили в админ-панели — пара получает ссылку так же, как из бота.
  // Возвращает { delivered }: заказ с сайта без Telegram доставить некуда.
  onPaid: async (application, guests) => {
    if (!bot) {
      console.warn('[index] бот не запущен — пара не получила ссылку');
      return { delivered: false };
    }
    return bot.notifyCouplePaid(application, guests);
  },
  onNewApplication: async (application, guests = []) => {
    if (!bot) {
      console.warn('[index] бот не запущен — заявка сохранена без уведомления админа');
      return;
    }
    await notifyNewApplication(bot.api, ADMIN_CHAT_IDS, application, BASE_URL, guests);
  },
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (BASE_URL: ${BASE_URL})`);
  if (DEV_NO_AUTH) console.log('[server] DEV_NO_AUTH=1 — форма доступна без Telegram (только для разработки!)');
  if (!ADMIN_CHAT_IDS.length) console.warn('[server] ADMIN_CHAT_IDS не задан — напишите боту, он подскажет ваш id');
  else console.log(`[server] админов: ${ADMIN_CHAT_IDS.length}`);
});

if (bot) {
  bot.start({
    onStart: (me) => {
      if (!RUNTIME.botUsername) RUNTIME.botUsername = me.username;
      console.log(`[bot] запущен: @${me.username}`);
    },
  });
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 20000).unref();
  try {
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      bot?.isRunning() ? bot.stop() : Promise.resolve(),
    ]);
    await db.close();
    clearTimeout(deadline);
    process.exit(0);
  } catch (error) { console.error('[shutdown]', error.message); process.exit(1); }
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
