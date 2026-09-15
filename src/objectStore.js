// Хранилище файлов библиотеки nVate: папка uploads на volume или S3-совместимое
// хранилище (Cloudflare R2).
//
// Код библиотеки не знает, где лежит звук: он кладёт файл по ключу и просит
// адрес для проигрывания. Локально это /uploads/<ключ>. В R2 — ссылка с
// подписью на несколько часов (бакет остаётся закрытым) или публичный адрес,
// если у бакета есть свой домен. Ключи доступа живут только в переменных
// сервера; студия и приглашение видят лишь адрес /api/music/audio/…, который
// сервер сам переводит на файл.
//
// Подпись — AWS Signature V4, без SDK: R2 понимает её так же, как S3.

import crypto from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MUSIC_STORAGE, S3 } from './config.js';
import { UPLOADS_DIR } from './upload.js';

const KEY_RE = /^(?:[a-z0-9-]+\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;
export const validKey = (key) => KEY_RE.test(String(key ?? ''));

const s3Ready = Boolean(S3.endpoint && S3.bucket && S3.accessKeyId && S3.secretAccessKey);
if (MUSIC_STORAGE === 's3' && !s3Ready) {
  console.warn('[storage] MUSIC_STORAGE=s3, но S3_ENDPOINT/S3_BUCKET/ключи не заданы — библиотека пишет в uploads');
}
// Куда кладём новые файлы. Старые файлы остаются там, где их записали: у каждой
// песни в базе своя пометка storage.
export const WRITE_STORAGE = MUSIC_STORAGE === 's3' && s3Ready ? 's3' : 'local';

export function storageInfo() {
  return { driver: WRITE_STORAGE, s3Configured: s3Ready, publicUrl: Boolean(S3.publicUrl) };
}

/* ── AWS Signature V4 ── */

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const rfc3986 = (value) => encodeURIComponent(value)
  .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const amzDate = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function signature({ secretAccessKey, region, date, scope, canonical, stamp }) {
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, date), region), 's3'), 'aws4_request');
  return crypto.createHmac('sha256', key).update(toSign).digest('hex');
}

/* Ссылка с подписью в адресе. host и pathname — уже готовые части URL
   (pathname закодирован), чтобы функцию можно было сверить с примером AWS. */
export function presign({ method = 'GET', protocol = 'https:', host, pathname, region, accessKeyId, secretAccessKey, expires = 3600, now = new Date() }) {
  const stamp = amzDate(now);
  const date = stamp.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(params).sort().map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`).join('&');
  const canonical = [method, pathname, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sig = signature({ secretAccessKey, region, date, scope, canonical, stamp });
  return `${protocol}//${host}${pathname}?${query}&X-Amz-Signature=${sig}`;
}

// Адрес объекта в стиле path: https://<endpoint>/<bucket>/<key>. R2 его понимает.
function objectTarget(key) {
  const base = new URL(S3.endpoint);
  const pathname = `${base.pathname.replace(/\/+$/, '')}/${rfc3986(S3.bucket)}/${key.split('/').map(rfc3986).join('/')}`;
  return { protocol: base.protocol, host: base.host, pathname };
}

async function s3Request(method, key, body = Buffer.alloc(0), contentType = '') {
  const { protocol, host, pathname } = objectTarget(key);
  const stamp = amzDate(new Date());
  const date = stamp.slice(0, 8);
  const scope = `${date}/${S3.region}/s3/aws4_request`;
  const payload = sha256(body);
  const headers = { host, 'x-amz-content-sha256': payload, 'x-amz-date': stamp };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, pathname, '', names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payload].join('\n');
  const sig = signature({ secretAccessKey: S3.secretAccessKey, region: S3.region, date, scope, canonical, stamp });
  const { host: _host, ...sent } = headers;
  const response = await fetch(`${protocol}//${host}${pathname}`, {
    method,
    headers: {
      ...sent,
      Authorization: `AWS4-HMAC-SHA256 Credential=${S3.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`,
    },
    body: method === 'PUT' ? body : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
    throw new Error(`storage ${method} ${response.status}`);
  }
}

/* ── Общий интерфейс ── */

export async function putObject({ buffer, ext, contentType }) {
  const name = `${crypto.randomUUID()}.${ext}`;
  if (WRITE_STORAGE === 's3') {
    const key = `music/${name}`;
    await s3Request('PUT', key, buffer, contentType);
    return { storage: 's3', key };
  }
  await writeFile(path.join(UPLOADS_DIR, name), buffer);
  return { storage: 'local', key: name };
}

export function objectUrl(storage, key) {
  if (!validKey(key)) return null;
  if (storage !== 's3') return `/uploads/${key}`;
  if (!s3Ready) return null;
  if (S3.publicUrl) return `${S3.publicUrl}/${key.split('/').map(rfc3986).join('/')}`;
  const { protocol, host, pathname } = objectTarget(key);
  return presign({
    protocol, host, pathname, region: S3.region,
    accessKeyId: S3.accessKeyId, secretAccessKey: S3.secretAccessKey, expires: S3.urlTtl,
  });
}

export async function removeObject(storage, key) {
  if (!validKey(key)) return;
  if (storage === 's3') {
    if (s3Ready) await s3Request('DELETE', key);
    return;
  }
  await unlink(path.join(UPLOADS_DIR, key)).catch(() => {});
}
