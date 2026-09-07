// The same bounded appearance contract is used by demos, previews and paid orders.
export const DESIGN_OPTIONS = Object.freeze({
  palette: ['original', 'sage', 'rose', 'midnight', 'terracotta'],
  light: ['daylight', 'golden', 'moonlight'],
  effect: ['signature', 'petals', 'leaves', 'fireflies', 'sparkles', 'none'],
  motion: ['slow', 'gentle', 'still'],
  typography: ['classic', 'editorial', 'romantic'],
});

export function normalizeDesign(raw = {}) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(DESIGN_OPTIONS).map(([key, values]) => [key,
    values.includes(input[key]) ? input[key] : values[0],
  ]));
}

export const STATIONERY = Object.freeze({
  oqshom: { name: 'Oqshom', theme: 'nocturne', tile: '50% 0%', effect: 'fireflies', ink: '#f6ecd6', paper: '#050d09', accent: '#d8b878', envelope: '#123a2c', ru: 'Изумрудная ночь · золото и звёзды', uz: 'Zumrad tun · oltin va yulduzlar' },
  nafis: { name: 'Nafis', theme: 'velvet', tile: '0% 0%', effect: 'petals', ink: '#f9ecdf', paper: '#0c0508', accent: '#e2bd85', envelope: '#4a1024', ru: 'Винный бархат · тёплое золото', uz: 'Bordo baxmal · iliq oltin' },
  nur: { name: 'Nur', theme: 'daylight', tile: '100% 0%', effect: 'sparkles', ink: '#4a4132', paper: '#fdfaf3', accent: '#c39a52', envelope: '#c8b184', ru: 'Утренний свет · стекло и золотая пыль', uz: 'Tong nuri · shisha va oltin chang' },
  gulzor: { name: 'Gulzor', theme: 'botanical', tile: '0% 50%', effect: 'leaves', ink: '#f0f5e8', paper: '#0a1a12', accent: '#8fb47f', envelope: '#3f5d3c', ru: 'Ночной цветник · листья и роса', uz: 'Tungi gulzor · barglar va shabnam' },
  marvarid: { name: 'Marvarid', theme: 'pearl', tile: '50% 50%', effect: 'petals', ink: '#5c3b44', paper: '#fbf1ef', accent: '#b76e7f', envelope: '#c99aa4', ru: 'Жемчужный перламутр · нежные переливы', uz: 'Marvarid jilo · nozik tovlanish' },
  charos: { name: 'Charos', theme: 'marble', tile: '100% 50%', effect: 'sparkles', ink: '#2f2f34', paper: '#f7f5f1', accent: '#b08c46', envelope: '#2b2b2f', ru: 'Белый мрамор · золотые арки', uz: 'Oq marmar · oltin ravoqlar' },
  shirin: { name: 'Shirin', theme: 'sunset', tile: '0% 100%', effect: 'petals', ink: '#fdf1e2', paper: '#2a1409', accent: '#efa07a', envelope: '#a24a24', ru: 'Тёплый закат · терракота и солнце', uz: 'Iliq shom · terrakota va quyosh' },
  deco: { name: 'Deco', theme: 'artdeco', tile: '50% 100%', effect: 'sparkles', ink: '#efe9dc', paper: '#0a0a0d', accent: '#c9a55a', envelope: '#101014', ru: 'Ар-деко · геометрия и чёрное золото', uz: 'Ar-deko · geometriya va qora oltin' },
  // Legacy — витрину покинули, но старые ссылки продолжают открываться
  atlas: { name: 'Atlas', theme: 'heritage', tile: '100% 0%', effect: 'sparkles', ink: '#703f32', paper: '#faf1dd', accent: '#b9784d', envelope: '#d6a06e', ru: 'Узбекский атлас · золотые нити', uz: 'O‘zbek atlasi · oltin iplar' },
});
