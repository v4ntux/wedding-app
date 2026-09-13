// Карточка с QR-кодом приглашения.
//
// Рамка nvate.uz (public/assets/share/qr-frame.png) — нежные цветы и золотые
// линии, в центре пустой белый квадрат. В него ложится уникальный QR-код ссылки
// пары, в тех же золотых тонах. Карточку бот присылает первой: её сканируют с
// экрана или печатают на столы и в конверты.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';

const FRAME_PATH = path.resolve(process.cwd(), 'public', 'assets', 'share', 'qr-frame.png');

// Внутренняя граница золотой рамки квадрата в пикселях исходника 1122×1402.
const WINDOW = { x: 284, y: 563, width: 552, height: 551 };
// Белое поле вокруг кода: сканеру нужно не меньше четырёх «клеток» тишины.
const QUIET = 60;

// Золото темнее, чем на рамке: сканеру нужен контраст с белым, глазу — тот же тон.
const INK_FROM = [112, 78, 30];
const INK_TO = [150, 110, 48];
const PAPER = [255, 253, 251];

let frame = null;
const cache = new Map();

function loadFrame() {
  if (!frame) frame = PNG.sync.read(readFileSync(FRAME_PATH));
  return frame;
}

function blend(img, x, y, rgb, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(img.data[i + c] * (1 - alpha) + rgb[c] * alpha);
  img.data[i + 3] = 255;
}

/* Скруглённый прямоугольник со сглаженным краем: покрытие пикселя считается
   по расстоянию до контура, поэтому точки кода не выглядят рваными. */
function roundRect(img, x0, y0, w, h, r, colorAt) {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      const dx = Math.max(Math.abs(x + 0.5 - cx) - (w / 2 - r), 0);
      const dy = Math.max(Math.abs(y + 0.5 - cy) - (h / 2 - r), 0);
      const alpha = Math.min(1, Math.max(0, 0.5 - (Math.hypot(dx, dy) - r)));
      blend(img, x, y, colorAt(x, y), alpha);
    }
  }
}

export function renderShareCard(url) {
  if (cache.has(url)) return cache.get(url);
  const base = loadFrame();
  const img = new PNG({ width: base.width, height: base.height });
  base.data.copy(img.data);

  const qr = QRCode.create(url, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const dark = (row, col) => Boolean(qr.modules.get(row, col));
  const box = Math.min(WINDOW.width, WINDOW.height) - QUIET * 2;
  const cell = Math.floor(box / size);
  const span = cell * size;
  const left = WINDOW.x + Math.round((WINDOW.width - span) / 2);
  const top = WINDOW.y + Math.round((WINDOW.height - span) / 2);

  // Лёгкий диагональный переход золота: от тёмного угла к светлому.
  const ink = (x, y) => {
    const k = Math.min(1, Math.max(0, ((x - left) + (y - top)) / (span * 2)));
    return INK_FROM.map((from, i) => from + (INK_TO[i] - from) * k);
  };
  const paper = () => PAPER;

  const finders = [[0, 0], [0, size - 7], [size - 7, 0]];
  const inFinder = (row, col) => finders.some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!dark(row, col) || inFinder(row, col)) continue;
      const gap = cell * 0.08;
      roundRect(img, left + col * cell + gap, top + row * cell + gap, cell - gap * 2, cell - gap * 2, cell * 0.32, ink);
    }
  }
  // Глазки кода — мягкие квадраты с точкой: так код узнаётся и сканером, и глазом.
  for (const [r, c] of finders) {
    const x = left + c * cell;
    const y = top + r * cell;
    roundRect(img, x, y, cell * 7, cell * 7, cell * 1.9, ink);
    roundRect(img, x + cell, y + cell, cell * 5, cell * 5, cell * 1.3, paper);
    roundRect(img, x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 0.95, ink);
  }

  const png = PNG.sync.write(img);
  cache.set(url, png);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return png;
}
