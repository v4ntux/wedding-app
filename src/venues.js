// Справочник тойхон: то, чего нет ни в Яндексе, ни в Google.
// Семя едет в git (catalog/venues.json), правки админа живут в settings.venues
// и перекрывают семя целиком — файл после первой правки можно не трогать.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getSetting, setSetting } from './db.js';

const SEED_PATH = path.resolve(process.cwd(), 'catalog', 'venues.json');
const KINDS = new Set(['toyxona', 'restoran', 'kafe', 'bog']);

const FALLBACK_CITY = { name: 'Mang‘it', nameRu: 'Мангит', lat: 42.116169, lng: 60.0625143, zoom: 14 };

let seed = null;

function loadSeed() {
  if (seed) return seed;
  try {
    seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'));
  } catch (error) {
    console.error('[venues] seed unavailable:', error.message);
    seed = { city: FALLBACK_CITY, venues: [] };
  }
  return seed;
}

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function slug(value, fallback) {
  const clean = text(value, 40).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

// Одна запись каталога. Возвращает null, если место нельзя поставить на карту.
function normalizeVenue(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const name = text(raw.name, 80);
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < 37 || lat > 46 || lng < 55 || lng > 74) return null;   // за пределами Узбекистана
  const seats = Math.max(0, Math.min(5000, Math.round(Number(raw.seats) || 0)));
  return {
    id: slug(raw.id || name, `venue-${index + 1}`),
    name,
    kind: KINDS.has(raw.kind) ? raw.kind : 'toyxona',
    address: text(raw.address, 160),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    seats,
    phone: text(raw.phone, 32),
    draft: raw.draft === true,
  };
}

function normalizeList(list) {
  const out = [];
  const seen = new Set();
  for (const [index, raw] of (Array.isArray(list) ? list : []).entries()) {
    const venue = normalizeVenue(raw, index);
    if (!venue || seen.has(venue.id)) continue;
    seen.add(venue.id);
    out.push(venue);
    if (out.length >= 300) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'uz'));
}

export function cityCenter() {
  const city = loadSeed().city ?? {};
  return {
    name: text(city.name, 60) || FALLBACK_CITY.name,
    nameRu: text(city.nameRu, 60) || FALLBACK_CITY.nameRu,
    lat: Number.isFinite(Number(city.lat)) ? Number(city.lat) : FALLBACK_CITY.lat,
    lng: Number.isFinite(Number(city.lng)) ? Number(city.lng) : FALLBACK_CITY.lng,
    zoom: Math.max(9, Math.min(18, Math.round(Number(city.zoom) || FALLBACK_CITY.zoom))),
  };
}

// Весь каталог, включая черновики — для админки.
export function allVenues() {
  const override = getSetting('venues');
  if (Array.isArray(override)) return normalizeList(override);
  return normalizeList(loadSeed().venues);
}

// Только опубликованные места — это и видят пары.
export function publicVenues() {
  return allVenues().filter((venue) => !venue.draft);
}

export function saveVenues(list) {
  const clean = normalizeList(list);
  setSetting('venues', clean);
  return clean;
}

export function findVenue(id) {
  const key = text(id, 40);
  return allVenues().find((venue) => venue.id === key) ?? null;
}
