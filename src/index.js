import { BOT_TOKEN, ADMIN_CHAT_ID, BASE_URL, PORT, DEV_NO_AUTH } from './config.js';
import { createBot, notifyNewApplication } from './bot.js';
import { createServer } from './server.js';

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
  bot = createBot({ token: BOT_TOKEN, adminChatId: ADMIN_CHAT_ID, baseUrl: BASE_URL });
}

const server = createServer({
  onNewApplication: async (application) => {
    if (!bot) {
      console.warn('[index] бот не запущен — заявка сохранена без уведомления админа');
      return;
    }
    await notifyNewApplication(bot.api, ADMIN_CHAT_ID, application, BASE_URL);
  },
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (BASE_URL: ${BASE_URL})`);
  if (DEV_NO_AUTH) console.log('[server] DEV_NO_AUTH=1 — форма доступна без Telegram (только для разработки!)');
  if (!ADMIN_CHAT_ID) console.warn('[server] ADMIN_CHAT_ID не задан — напишите боту, он подскажет ваш id');
});

if (bot) {
  bot.start({
    onStart: (me) => console.log(`[bot] запущен: @${me.username}`),
  });
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
