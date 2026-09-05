import { bootEditor } from "./studio.js";

export const $ = (id) => document.getElementById(id);
export const text = (tag, value, cls = "") => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (cls) el.className = cls;
  return el;
};
export const escape = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeLink = (value) => {
  try {
    const u = new URL(value, location.origin);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
};
export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, v);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
export const state = {
  lang: storage.get("nvate_language") || "ru",
  config: null,
  filter: "all",
  templateId: null,
  view: "collection",
};
if (!["ru", "uz"].includes(state.lang)) state.lang = "ru";
const ru = Object.fromEntries(
  [...document.querySelectorAll("[data-key]")].map((el) => [
    el.dataset.key,
    el.textContent,
  ]),
);
Object.assign(ru, {
  headline: "Искусство <em>приглашать.</em>",
  collectionNote: "Пять настроений.<br>Одна ваша история.",
  choose: "Выбрать дизайн",
  open: "Открыть приглашение",
  sum: "сум",
  retry: "Попробовать снова",
  net: "Не удалось загрузить данные. Проверьте соединение.",
  saved: "Черновик на этом устройстве",
  notSaved: "Не удалось сохранить черновик",
  submit: "Отправить заявку",
  sending: "Отправляем…",
  uploading: "Загружаем…",
  photoNeed: "Минимум {n} фото · максимум {max}",
  photoError: "Добавьте минимум {n} фото.",
  tooMany: "Можно загрузить до {n} фотографий.",
  photoRemove: "Удалить фотографию",
  fileError: "Проверьте формат и размер файла (до 16 МБ).",
  contactError: "Укажите два корректных контакта.",
  required: "Заполните обязательные поля.",
  musicError: "Укажите ссылку YouTube или прямую ссылку на MP3, M4A, WAV, OGG.",
  guestError: "Не больше {n} гостей. Имя — до 50 символов.",
  guestCount: "Гостей: {n} · {price}",
  successCopy:
    "Заявка №{id} сохранена. Администратор свяжется с вами для подтверждения и оплаты.",
  empty: "Здесь появятся ваши приглашения после отправки заявки.",
  telegram:
    "Для загрузки фото и отправки заявки откройте студию через Telegram-бота.",
  openBot: "Открыть Telegram",
  pending: "Ожидает подтверждения",
  paid: "Готово",
  cancelled: "Отклонено",
  personalInvitation: "ЛИЧНОЕ ПРИГЛАШЕНИЕ",
  continue: "Продолжить",
});
const uz = {
  skip: "Asosiy qismga o‘tish",
  collection: "Kolleksiya",
  mine: "Taklifnomalarim",
  atelier: "TO‘Y TAKLIFNOMALARI",
  headline: "Taklif etish <em>san’ati.</em>",
  lead: "Unutilmas kuningiz go‘zal taklifnomadan boshlanadi.",
  collectionNote: "Besh kayfiyat.<br>Sizning bir hikoyangiz.",
  all: "Barcha dizaynlar",
  light: "Yorug‘",
  dark: "To‘q",
  previewHint: "Har bir taklifnomani ochib ko‘ring",
  loading: "Kolleksiya ochilmoqda…",
  footerNote: "Sizning abadiy sevgingiz uchun.",
  footer: "Sizning kuningiz. Sizning hikoyangiz.",
  backCollection: "Kolleksiyaga",
  yourInvitation: "SIZNING TAKLIFNOMANGIZ",
  details: "Tafsilotlar",
  media: "Muhit",
  guests: "Mehmonlar",
  finish: "Yakunlash",
  detailsTitle: "Hammasi sizdan boshlanadi",
  detailsIntro: "Ismlar, sana va yaqinlaringiz bilan uchrashuv manzili.",
  groom: "Kuyovning ismi",
  bride: "Kelinning ismi",
  date: "To‘y sanasi",
  time: "Vaqti",
  venue: "To‘yxona va manzil",
  mapEnabled: "Mehmonlar uchun xarita qo‘shish",
  coordinatesHint:
    "Google yoki Yandex xaritadan joy koordinatalarini ko‘chiring.",
  latitude: "Kenglik",
  longitude: "Uzunlik",
  checkMap: "Xaritada tekshirish ↗",
  mediaTitle: "Tuyg‘ular jonlansin",
  mediaIntro: "Suratlar va musiqa taklifnomangizni yanada shaxsiy qiladi.",
  photos: "Suratlar",
  addPhotos: "Surat qo‘shish",
  music: "Musiqa",
  noMusic: "Musiqasiz",
  uploadMusic: "Audio yuklash",
  musicLink: "YouTube yoki audio havolasi",
  musicStart: "Boshlanishi, soniya",
  musicEnd: "Oxiri, soniya (ixtiyoriy)",
  guestsTitle: "Har biriga — shaxsan",
  guestsIntro:
    "Har bir mehmon o‘z ismini taklifnomada ko‘radi va alohida havola oladi.",
  personalInvitation: "SHAXSIY TAKLIFNOMA",
  guestExample: "Hurmatli Dilnoza,",
  guestExampleBody: "sizni baxtli kunimizda ko‘rishdan xursand bo‘lamiz.",
  enableGuests: "Ismli taklifnomalar yaratish",
  guestList: "Mehmon ismlari — har biri yangi qatordan",
  guestsOptional:
    "Barcha mehmonlar uchun umumiy taklifnomani qoldirish ham mumkin.",
  finishTitle: "So‘nggi tafsilotlar",
  finishIntro:
    "Ikkita aloqa ma’lumotini qoldiring. Administrator tasdiqlash va to‘lov uchun bog‘lanadi.",
  phone: "Telefon",
  extraContact: "Qo‘shimcha aloqa",
  personalLinks: "Ismli havolalar",
  total: "Jami",
  paymentHint: "To‘lov tasdiqlangach, tayyor havolani Telegram orqali olasiz.",
  fullPreview: "To‘liq taklifnomani tekshirish",
  back: "Orqaga",
  continue: "Davom etish",
  livePreview: "Sizning taklifnomangiz",
  previewSample:
    "Dizayn ko‘rinishi. Suratlaringiz va musiqa — to‘liq ko‘rinishda.",
  openEnvelope: "Ochish uchun muhrni bosing",
  choose: "Dizaynni tanlash",
  received: "ARIZA QABUL QILINDI",
  successTitle: "Go‘zal hikoyaning boshlanishi.",
  open: "Taklifnomani ochish",
  sum: "so‘m",
  retry: "Qayta urinish",
  net: "Ma’lumot yuklanmadi. Internetni tekshiring.",
  saved: "Qoralama shu qurilmada saqlandi",
  notSaved: "Qoralama saqlanmadi",
  submit: "Ariza yuborish",
  sending: "Yuborilmoqda…",
  uploading: "Yuklanmoqda…",
  photoNeed: "Kamida {n} surat · ko‘pi bilan {max}",
  photoError: "Kamida {n} surat qo‘shing.",
  tooMany: "Ko‘pi bilan {n} surat yuklash mumkin.",
  photoRemove: "Suratni o‘chirish",
  fileError: "Fayl formati va hajmini tekshiring (16 MB gacha).",
  contactError: "Ikkita to‘g‘ri aloqa ma’lumotini kiriting.",
  required: "Majburiy maydonlarni to‘ldiring.",
  musicError: "YouTube yoki MP3, M4A, WAV, OGG havolasini kiriting.",
  guestError: "Ko‘pi bilan {n} mehmon. Ism 50 belgigacha.",
  guestCount: "Mehmonlar: {n} · {price}",
  successCopy:
    "№{id} ariza saqlandi. Administrator tasdiqlash va to‘lov uchun bog‘lanadi.",
  empty: "Ariza yuborgandan so‘ng taklifnomalaringiz shu yerda paydo bo‘ladi.",
  telegram: "Surat yuklash va ariza yuborish uchun Telegram bot orqali oching.",
  openBot: "Telegramni ochish",
  pending: "Tasdiq kutilmoqda",
  paid: "Tayyor",
  cancelled: "Rad etilgan",
};
Object.assign(ru, {
  findVenue: "Найти место на карте",
  search: "Найти",
  findMusic: "Поиск музыки",
  musicSample:
    "В каталоге — 30-секундные фрагменты. Полный трек можно загрузить файлом.",
  noResults: "Ничего не найдено. Попробуйте другой запрос.",
  selectTrack: "Выбрать",
  listen: "Прослушать",
  pause: "Пауза",
});
Object.assign(uz, {
  findVenue: "Xaritadan joy topish",
  search: "Topish",
  findMusic: "Musiqa qidirish",
  musicSample:
    "Katalogda 30 soniyali parchalar mavjud. To‘liq trekni fayl orqali yuklashingiz mumkin.",
  noResults: "Hech narsa topilmadi. Boshqa so‘rovni sinab ko‘ring.",
  selectTrack: "Tanlash",
  listen: "Tinglash",
  pause: "To‘xtatish",
});
export function t(key, values = {}) {
  let s = (state.lang === "uz" ? uz[key] : ru[key]) || ru[key] || key;
  for (const [k, v] of Object.entries(values))
    s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
export function money(n) {
  return `${Number(n || 0).toLocaleString("ru-RU")} ${t("sum")}`;
}
export function localize() {
  document.documentElement.lang = state.lang;
  document
    .querySelectorAll("[data-key]")
    .forEach((el) => (el.textContent = t(el.dataset.key)));
  document
    .querySelectorAll("[data-key-html]")
    .forEach((el) => (el.innerHTML = t(el.dataset.keyHtml)));
  document
    .querySelectorAll("[data-lang]")
    .forEach((el) =>
      el.setAttribute("aria-pressed", String(el.dataset.lang === state.lang)),
    );
  document.title =
    state.lang === "ru"
      ? "nvate — Свадебное ателье"
      : "nvate — To‘y taklifnomalari";
}
let toastTimer;
export function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 6000);
}
export async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "x-init-data": window.Telegram?.WebApp?.initData || "",
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(t("net"));
  }
  if (!response.ok || data.ok === false) {
    const err = new Error(
      response.status === 401 ? t("telegram") : data.error || t("net"),
    );
    err.step = data.step;
    throw err;
  }
  return data;
}
export function showView(name) {
  state.view = name;
  for (const v of ["collection", "editor", "mine"])
    $(v + "-view").hidden = v !== name;
  document
    .querySelectorAll(".nav-link")
    .forEach((b) => b.classList.toggle("active", b.id === name + "-nav"));
  if (name !== "editor") $("live-frame").src = "about:blank";
  window.scrollTo({ top: 0, behavior: "instant" });
}
export function renderGallery() {
  const gallery = $("gallery");
  gallery.replaceChildren();
  gallery.classList.toggle("filtered", state.filter !== "all");
  for (const [index, tpl] of state.config.templates.entries()) {
    if (state.filter !== "all" && tpl.tone !== state.filter) continue;
    const card = text("article", "", "template-card");
    card.style.setProperty("--i", index);
    const art = text("button", "", `template-art art-${tpl.id}`);
    art.type = "button";
    art.style.setProperty("--art", `url("${tpl.previewImage}")`);
    art.setAttribute("aria-label", `${t("open")}: ${tpl.name}`);
    art.innerHTML = `<span class="card-edition">N° ${String(index + 1).padStart(2, "0")}</span><span class="card-tag">${escape(tpl.material || "ATELIER")}</span><span class="invitation-mini"><span class="mini-kicker">${state.lang === "ru" ? "МЫ ЖЕНИМСЯ" : "BIZNING TO‘YIMIZ"}</span><span class="mini-names">${state.lang === "ru" ? "Александр" : "Javohir"}<i>&</i>${state.lang === "ru" ? "София" : "Madina"}</span><span class="mini-rule"></span><span class="mini-date">19 · 09 · ${new Date().getFullYear() + 1}</span><span class="mini-bottom">${state.lang === "ru" ? "С ЛЮБОВЬЮ К ВАМ" : "MEHR BILAN"}</span></span><span class="preview-cue">${escape(t("open"))} ↗</span>`;
    art.onclick = () => openDemo(tpl);
    const meta = text("div", "", "template-meta");
    const title = text("div", "");
    title.append(
      text("h2", tpl.name),
      text("p", tpl.description?.[state.lang] || "", "template-subtitle"),
    );
    meta.append(title, text("p", money(tpl.price), "template-price"));
    const bottom = text("div", "", "template-bottom");
    const swatches = text("span", "", "swatches");
    swatches.ariaHidden = "true";
    for (const color of tpl.colors) {
      const swatch = document.createElement("i");
      swatch.style.background = color;
      swatches.append(swatch);
    }
    const select = text("button", "", "template-select");
    select.innerHTML = `<span>${escape(t("choose"))}</span><span>↗</span>`;
    select.onclick = () => editor.choose(tpl.id);
    bottom.append(swatches, select);
    card.append(art, meta, bottom);
    gallery.append(card);
  }
}
let previewTpl = null;
export function openDemo(tpl, query = new URLSearchParams()) {
  previewTpl = tpl;
  query.set("lang", state.lang);
  if (!query.get("groom")) query.set("groom", state.lang === "ru" ? "Александр" : "Javohir");
  if (!query.get("bride")) query.set("bride", state.lang === "ru" ? "София" : "Madina");
  $("preview-title").textContent = tpl.name;
  $("preview-frame").removeAttribute("srcdoc");
  $("preview-frame").src = `${tpl.demoUrl}?${query}`;
  $("choose-preview").hidden = false;
  if (!$("preview-dialog").open) $("preview-dialog").showModal();
}
$("preview-dialog").addEventListener("close", () => {
  $("preview-frame").src = "about:blank";
  $("preview-frame").removeAttribute("srcdoc");
});
$("close-preview").onclick = () => $("preview-dialog").close();
$("choose-preview").onclick = () => {
  if (previewTpl) {
    $("preview-dialog").close();
    editor.choose(previewTpl.id);
  }
};
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      state.filter = b.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      renderGallery();
    }),
);
document.querySelectorAll("[data-lang]").forEach(
  (b) =>
    (b.onclick = () => {
      state.lang = b.dataset.lang;
      storage.set("nvate_language", state.lang);
      localize();
      if (state.config) {
        renderGallery();
        editor.refresh();
        if (state.view === "mine") loadMine();
      }
    }),
);
$("collection-nav").onclick = $("back-collection").onclick = () =>
  showView("collection");
export async function loadMine() {
  showView("mine");
  const root = $("mine-list");
  root.replaceChildren(text("p", t("loading"), "loading"));
  try {
    const data = await api("/api/my");
    root.replaceChildren();
    if (!data.apps.length) {
      root.append(text("p", t("empty"), "empty-state"));
      return;
    }
    for (const item of data.apps) {
      const box = text("article", "", "mine-item");
      box.append(
        text("h2", `${item.groom} & ${item.bride}`),
        text(
          "p",
          `${item.date} · ${t(item.status === "new" ? "pending" : item.status)} · ${money(item.total)}`,
        ),
      );
      for (const link of [{ name: t("open"), url: item.url }, ...item.guests]) {
        const url = safeLink(link.url || "");
        if (!link.url || !url) continue;
        const a = text("a", `${link.name} ↗`);
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        box.append(a);
      }
      root.append(box);
    }
  } catch (e) {
    root.replaceChildren(text("p", e.message, "empty-state"));
    if (state.config?.botUrl) {
      const a = text("a", t("openBot"), "text-button");
      a.href = safeLink(state.config.botUrl);
      a.target = "_blank";
      a.rel = "noopener";
      root.append(a);
    }
  }
}
$("mine-nav").onclick = $("mobile-mine").onclick = loadMine;
const theme = storage.get("nvate_theme");
document.documentElement.dataset.theme = theme || "dark";
$("theme-toggle").onclick = () => {
  const value =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = value;
  storage.set("nvate_theme", value);
};
$("year").textContent = new Date().getFullYear();
const editor = bootEditor({
  $,
  text,
  escape,
  safeLink,
  storage,
  state,
  t,
  money,
  api,
  toast,
  showView,
  openDemo,
});
async function init() {
  localize();
  try {
    state.config = await api("/api/config");
    renderGallery();
    editor.restore();
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  } catch (e) {
    $("gallery").replaceChildren(text("p", e.message, "form-error"));
    const retry = text("button", t("retry"), "primary");
    retry.onclick = init;
    $("gallery").append(retry);
  }
}
init();
