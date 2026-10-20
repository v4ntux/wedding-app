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
  // Без золота и ночи: печатная полоса и гранатовый плакат
  chizgi: { name: 'Chizgi', theme: 'press', tile: '100% 100%', effect: 'none', ink: '#14140f', paper: '#ece9e1', accent: '#d93a1e', envelope: '#14140f', ru: 'Типографская полоса · бумага, штрих и киноварь', uz: 'Bosma chizgi · qog‘oz, shtrix va qizil' },
  anor: { name: 'Anor', theme: 'riso', tile: '0% 0%', effect: 'petals', ink: '#fdeed6', paper: '#a92a3c', accent: '#f4a259', envelope: '#5e0f1e', ru: 'Гранатовый плакат · ризография и сливки', uz: 'Anor plakati · rizografiya va qaymoq' },
  // Линейка 2026: у каждой темы своя сцена открытия, своя геометрия и свой моушн
  darvoza: { name: 'Darvoza', theme: 'gate', tile: '50% 0%', effect: 'none', ink: '#3a2618', paper: '#efe2cc', accent: '#1f9c9a', envelope: '#4a2e1c', ru: 'Резные ворота Хивы · 3D-створки, изразец и свет двора', uz: 'Xiva darvozasi · 3D eshik, koshin va hovli nuri' },
  uzuk: { name: 'Uzuk', theme: 'rings3d', tile: '50% 50%', effect: 'none', ink: '#f3eee6', paper: '#0a0a0b', accent: '#d9b56c', envelope: '#1a1a1d', ru: 'Два кольца в 3D · WebGL, золото и студийный свет', uz: 'Ikki uzuk 3D · WebGL, oltin va studiya nuri' },
  kitob: { name: 'Kitob', theme: 'book3d', tile: '0% 50%', effect: 'none', ink: '#2b2622', paper: '#f7f1e3', accent: '#8e2c2c', envelope: '#1c2a44', ru: 'Семейная книга · 3D-обложка и страницы, которые листаются', uz: 'Oilaviy kitob · 3D muqova va varaqlanadigan sahifalar' },
  hikoya: { name: 'Hikoya', theme: 'story', tile: '100% 50%', effect: 'none', ink: '#111111', paper: '#f1ece4', accent: '#ff5a36', envelope: '#111111', ru: 'История в сценах · имена-вырез, лента и слова, которые загораются', uz: 'Sahnalardagi hikoya · ism-kesma, lenta va yonadigan so‘zlar' },
  kino: { name: 'Kino', theme: 'cinema', tile: '0% 100%', effect: 'none', ink: '#efe6d2', paper: '#0c0b0a', accent: '#c7372f', envelope: '#1a1814', ru: 'Свадьба как премьера · ракорд 3-2-1, субтитры, плёнка и титры', uz: 'To‘y — premyera · 3-2-1 lenta, subtitrlar, kinotasma va titrlar' },
  lola: { name: 'Lola', theme: 'tulips', tile: '50% 0%', effect: 'petals', ink: '#4a3b3b', paper: '#fbf6ee', accent: '#c4505b', envelope: '#e9727a', ru: 'Акварельные тюльпаны · сад, который растёт при прокрутке', uz: 'Akvarel lolalar · aylantirganda o‘sadigan bog‘' },
  jilo: { name: 'Jilo', theme: 'holo', tile: '100% 0%', effect: 'none', ink: '#1d1b26', paper: '#f4f3f8', accent: '#7a5cff', envelope: '#c9b8ff', ru: 'Голографическая карта · фольга за наклоном телефона и карты кошелька', uz: 'Golografik karta · telefon qiyaligiga ergashuvchi folga' },
  ipak: { name: 'Ipak', theme: 'ikat', tile: '0% 0%', effect: 'none', ink: '#1f1633', paper: '#fff8ee', accent: '#d6246e', envelope: '#2a3a8f', ru: 'Узбекский икат · шёлковые ленты и смелые цветовые блоки', uz: 'O‘zbek adrasi · ipak lentalar va yorqin rang bloklari' },
  xabar: { name: 'Xabar', theme: 'chat', tile: '50% 100%', effect: 'none', ink: '#1c2733', paper: '#e9f0f5', accent: '#2f7fc1', envelope: '#3b6fb3', ru: 'Приглашение-переписка · уведомление, чат, геопозиция и голосовое', uz: 'Yozishma-taklifnoma · bildirishnoma, chat, joylashuv va ovozli xabar' },
  sof: { name: 'Sof', theme: 'quiet', tile: '0% 50%', effect: 'none', ink: '#161616', paper: '#f6f4ef', accent: '#161616', envelope: '#d9d4ca', ru: 'Тихая роскошь · калька, тонкая антиква и чёрно-белые снимки', uz: 'Sokin hashamat · kalka, nozik shrift va oq-qora suratlar' },
  moviy: { name: 'Moviy', theme: 'tiles', tile: '100% 100%', effect: 'none', ink: '#142a5e', paper: '#fbfaf6', accent: '#1e3f8a', envelope: '#2aa5b5', ru: 'Самаркандский изразец · мозаика, гирих и силуэт Регистана', uz: 'Samarqand koshini · mozaika, girih va Registon siluyeti' },
  nozik: { name: 'Nozik', theme: 'coquette', tile: '50% 50%', effect: 'none', ink: '#5c2a3a', paper: '#fff8f3', accent: '#d98a9b', envelope: '#f2b8c4', ru: 'Атласные банты и жемчуг · бант развязывается, сердце из жемчуга', uz: 'Atlas bantlar va marvarid · bant yechiladi, marvarid yurak' },
  // Legacy — витрину покинули, но старые ссылки продолжают открываться
  atlas: { name: 'Atlas', theme: 'heritage', tile: '100% 0%', effect: 'sparkles', ink: '#703f32', paper: '#faf1dd', accent: '#b9784d', envelope: '#d6a06e', ru: 'Узбекский атлас · золотые нити', uz: 'O‘zbek atlasi · oltin iplar' },
});
