import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

// Тип определяем по сигнатуре файла, а не по заголовку клиента.
// Возвращает { ext, kind: 'image' | 'audio' } или null.
export function detectFileType(buf) {
  if (buf.length < 12) return null;
  const s4 = buf.toString('latin1', 0, 4);
  // изображения
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', kind: 'image' };
  if (buf[0] === 0x89 && s4.slice(1) === 'PNG') return { ext: 'png', kind: 'image' };
  if (s4 === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { ext: 'webp', kind: 'image' };
  // аудио
  if (buf.toString('latin1', 0, 3) === 'ID3') return { ext: 'mp3', kind: 'audio' };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: 'mp3', kind: 'audio' };
  if (s4 === 'OggS') return { ext: 'ogg', kind: 'audio' };
  if (s4 === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE') return { ext: 'wav', kind: 'audio' };
  if (buf.toString('latin1', 4, 8) === 'ftyp') return { ext: 'm4a', kind: 'audio' };
  return null;
}

// Возвращает { file, kind } или null, если формат не поддерживается.
export function saveUpload(buf) {
  const type = detectFileType(buf);
  if (!type) return null;
  const name = `${crypto.randomUUID()}.${type.ext}`;
  writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return { file: name, kind: type.kind };
}
