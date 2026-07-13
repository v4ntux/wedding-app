// Транслитерация кириллицы (русская + узбекская) и узбекской латиницы в url-safe вид.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // узбекская кириллица
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

// Slug-и, конфликтующие с маршрутами сервера и страницами сайта.
export const RESERVED_SLUGS = new Set([
  'app', 'api', 'demo', 'music', 'admin', 'static', 'assets', 'favicon.ico', 'robots.txt',
  'uploads', 'site', 'templates', 'shablonlar', 'how', 'pricing', 'narxlar', 'faq', 'contact', 'aloqa',
]);

export function slugify(text) {
  const lower = String(text ?? '').toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else out += ch;
  }
  return out
    .normalize('NFD')
    .replace(/[̀-ͯʻʼ‘’']/g, '') // диакритика и апострофы (oʻ, g')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function coupleSlugBase(groomName, brideName) {
  const g = slugify(groomName);
  const b = slugify(brideName);
  if (!g || !b) return '';
  return `${g}-and-${b}`;
}

// Подбирает свободный slug: base, base-2, base-3...
export function uniqueSlug(base, isTaken) {
  let candidate = base;
  if (!candidate || RESERVED_SLUGS.has(candidate)) candidate = `wedding-${Date.now()}`;
  if (!isTaken(candidate)) return candidate;
  for (let i = 2; i < 1000; i++) {
    const next = `${candidate}-${i}`;
    if (!isTaken(next)) return next;
  }
  return `${candidate}-${Date.now()}`;
}
