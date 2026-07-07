import crypto from 'node:crypto';

// Проверка подписи Telegram Web App initData.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Возвращает объект user или null, если подпись невалидна/устарела.
export function validateInitData(initData, botToken, maxAgeSec = 86400) {
  try {
    if (!initData || !botToken) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const authDate = Number(params.get('auth_date') ?? 0);
    if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

    const user = JSON.parse(params.get('user') ?? 'null');
    if (!user || typeof user.id !== 'number') return null;
    return user;
  } catch {
    return null;
  }
}
