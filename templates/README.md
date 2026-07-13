# Шаблоны приглашений

Каждый шаблон — папка: `templates/<id>/manifest.json` + `templates/<id>/template.html`.
Новый шаблон = положить папку. Код менять не нужно, сервер подхватывает на лету (fs.watch).
Сломанный шаблон пропускается с ошибкой в логе и не роняет остальные.

## manifest.json

```json
{
  "name": "Marsala",              // имя в каталоге и форме
  "event": "wedding",             // wedding | birthday | anniversary (см. EVENTS в src/templateStore.js)
  "price": 129000,                // цена в сумах
  "minPhotos": 1,                 // минимум фото для этого дизайна
  "colors": ["#5C2233", "#F4EFE4"], // палитра карточки в форме (до 4)
  "order": 1,                     // порядок в каталоге (меньше = выше)
  "strings": {                    // (необязательно) переопределение текстов LOCALES
    "uz": { "invite": "..." },
    "ru": { "until": "До юбилея осталось" }
  }
}
```

## template.html

Обычный HTML со вставками:

- `{{x}}` — значение с экранированием: `{{groom}}`, `{{bride}}`, `{{groomInitial}}`, `{{brideInitial}}`,
  `{{dateText}}`, `{{day}}`, `{{monthName}}`, `{{year}}`, `{{weekday}}`, `{{time}}`, `{{targetIso}}`,
  `{{address}}`, `{{guestName}}`, `{{lang}}`, строки локали `{{L.sub}}`, `{{L.invite}}`, `{{L.openHint}}` и т.д.
- `{{{x}}}` — готовые блоки движка (вставлять как есть):
  `{{{experienceCSS}}}` (в `<head>`, до своего CSS), `{{{experienceScript}}}`, `{{{audioWidget}}}`,
  `{{{map}}}`, `{{{countdown}}}`, `{{{grain}}}` (текстура для CSS `background-image`).
- Условия и циклы: `{{#if guestName}}...{{else}}...{{/if}}`, `{{#if photos.0}}...{{/if}}`,
  `{{#each photos}}<img src="{{this}}">{{/each}}`.

## Обязательная разметка

1. **Конверт** — блок `.envx` с `id="envx"`/`id="env"` (скопируйте из любого шаблона).
   Скин задаётся CSS-переменными `--envx-bg`, `--env-face`, `--env-flap`, `--env-paper`, `--env-hint`.
2. **Отсчёт** — элементы с `id="cd" ch cm cs"` внутри секции отсчёта + `{{{countdown}}}` перед `</body>`.
3. **Появление при скролле** — класс `fx` на секциях (задержка через `style="--d:.2s"`).
4. Порядок в конце `<body>`: `{{{audioWidget}}}` → `{{{experienceScript}}}` → `{{{countdown}}}`.
