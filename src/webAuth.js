/* ── Пара на сайте, без Telegram ──
   Внутри бота пару узнаём по подписи initData. На nvate.uz/app подписи нет,
   поэтому браузер получает свою сессию: случайный токен в HttpOnly-cookie, а в
   базе — только его sha256. Id такой пары — номер сессии со знаком минус (см.
   web_sessions в schema.js), так что заявки, песни и черновики работают для
   обоих входов одинаково.

   Сессию заводит только студия (POST /api/session при запуске): остальные
   адреса принимают готовую cookie и без неё отвечают 401 — случайный запрос
   с улицы не плодит строки в базе. SameSite=Lax не пускает cookie в чужие
   POST-запросы, поэтому подделать отправку с другого сайта нельзя. */
import crypto from 'node:crypto';
import * as db from './db.js';

export const WEB_COOKIE = 'nv_sid';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const YEAR_MS = 365 * 24 * 3600 * 1000;

// Hash → id. Сессия не меняет владельца, поэтому помнить её можно долго.
const known = new Map();
function remember(hash, id) {
  known.set(hash, id);
  if (known.size > 5000) known.delete(known.keys().next().value);
}

const hashOf = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

export async function webUser(req) {
  const token = readCookie(req, WEB_COOKIE);
  if (!token || !TOKEN_RE.test(token)) return null;
  const hash = hashOf(token);
  let id = known.get(hash);
  if (!id) {
    id = await db.webSessionUser(hash);
    if (!id) return null;
    remember(hash, id);
  }
  return { id, web: true, username: null };
}

// Есть сессия — возвращаем её, нет — заводим и отдаём браузеру cookie.
export async function openWebSession(req, res) {
  const current = await webUser(req);
  if (current) return current;
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = hashOf(token);
  const id = await db.createWebSession(hash);
  remember(hash, id);
  res.cookie(WEB_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/',
    maxAge: YEAR_MS,
  });
  return { id, web: true, username: null, fresh: true };
}
