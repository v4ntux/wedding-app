// Файловое хранилище шаблонов приглашений: templates/<id>/{manifest.json, template.html}.
// Новый шаблон = положить папку — код менять не нужно, подхватывается на лету (fs.watch).
// Сломанный шаблон пропускается с ошибкой в лог и не роняет платформу.

import { readdirSync, readFileSync, existsSync, watch } from 'node:fs';
import path from 'node:path';
import { parseTemplate } from './templateEngine.js';

export const TEMPLATES_DIR = path.resolve(process.cwd(), 'templates');

// Типы событий платформы. Событие «активно», когда для него есть хотя бы один шаблон.
export const EVENTS = [
  { id: 'wedding', uz: 'To‘y', ru: 'Свадьба', emoji: '💍' },
  { id: 'birthday', uz: 'Tug‘ilgan kun', ru: 'День рождения', emoji: '🎂' },
];

let cache = null;

function loadOne(id) {
  const dir = path.join(TEMPLATES_DIR, id);
  const manifestPath = path.join(dir, 'manifest.json');
  const htmlPath = path.join(dir, 'template.html');
  if (!existsSync(manifestPath) || !existsSync(htmlPath)) {
    throw new Error('нужны manifest.json и template.html');
  }
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const name = String(m.name ?? id).slice(0, 60);
  const price = Number(m.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('в manifest.json нет корректного price');
  const event = EVENTS.some((e) => e.id === m.event) ? m.event : 'wedding';
  return {
    id,
    name,
    event,
    price,
    minPhotos: Number.isInteger(m.minPhotos) && m.minPhotos >= 0 ? m.minPhotos : 1,
    colors: Array.isArray(m.colors) ? m.colors.slice(0, 4).map(String) : [],
    order: Number.isFinite(Number(m.order)) ? Number(m.order) : 999,
    demoUrl: `/demo/${id}`,
    // локализация поверх базовой (см. LOCALES в render.js): { uz: {...}, ru: {...} }
    strings: m.strings && typeof m.strings === 'object' ? m.strings : null,
    tree: parseTemplate(readFileSync(htmlPath, 'utf8')),
  };
}

function load() {
  const list = [];
  if (existsSync(TEMPLATES_DIR)) {
    for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        list.push(loadOne(entry.name));
      } catch (e) {
        console.error(`[templates] "${entry.name}" пропущен: ${e.message}`);
      }
    }
  }
  list.sort((a, b) => a.order - b.order || a.price - b.price);
  cache = { list, byId: new Map(list.map((t) => [t.id, t])) };
  console.log(`[templates] загружено ${list.length}: ${list.map((t) => t.id).join(', ') || '—'}`);
  return cache;
}

function store() {
  return cache ?? load();
}

export function allTemplates() {
  return store().list;
}

export function getTemplate(id) {
  return store().byId.get(id) ?? null;
}

// Совместимо по форме с прежним findTemplate из config.js (id, name, price, minPhotos...).
export function findTemplate(id) {
  return getTemplate(id);
}

// Данные для /api/config и каталога на сайте (без дерева рендера).
export function publicTemplates() {
  return allTemplates().map(({ tree, strings, ...pub }) => pub);
}

// События с флагом активности — «скоро» в форме, пока нет шаблонов.
export function publicEvents() {
  const have = new Set(allTemplates().map((t) => t.event));
  return EVENTS.map((e) => ({ ...e, active: have.has(e.id) }));
}

// Горячая перезагрузка: правка/добавление шаблона подхватывается без рестарта.
if (existsSync(TEMPLATES_DIR)) {
  try {
    let timer = null;
    watch(TEMPLATES_DIR, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cache = null;
        console.log('[templates] изменения в templates/ — перезагрузка');
      }, 300);
    });
  } catch (e) {
    console.warn('[templates] fs.watch недоступен, шаблоны читаются один раз:', e.message);
  }
}
