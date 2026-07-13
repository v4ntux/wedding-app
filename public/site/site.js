// nvate — общий скрипт маркетингового сайта: локализация UZ/RU, появление при
// скролле, навбар, аккордеон FAQ, живой каталог шаблонов из /api/config.
(function () {
  'use strict';

  /* ---------- Локализация ---------- */
  var I18N = {
    uz: {
      'nav.home': 'Bosh sahifa', 'nav.templates': 'Shablonlar', 'nav.how': 'Qanday ishlaydi', 'nav.faq': 'FAQ', 'nav.cta': 'Boshlash',
      'title.index': 'nvate — raqamli taklifnoma', 'title.templates': 'Shablonlar — nvate', 'title.faq': 'FAQ — nvate',
      'hero.eyebrow': 'Raqamli taklifnoma',
      'hero.title': 'Eng muhim kuningizga — eng go‘zal taklifnoma',
      'hero.lead': 'Konvert ochiladi, musiqa yangraydi — mehmonlaringiz sana, manzil va xaritani bitta havolada ko‘radi.',
      'hero.cta1': 'Taklifnoma yaratish', 'hero.cta2': 'Namunalarni ko‘rish',
      'hero.note': 'To‘y · Tug‘ilgan kun',
      'env.eyebrow': 'Taklifnoma', 'env.date': '19 · 09 · 2026',
      'why.eyebrow': 'Nega nvate', 'why.title': 'Taklifnoma emas — taassurot',
      'why1.h': 'Konvert jonli ochiladi',
      'why1.p': 'Mehmon havolani ochganda muhrlangan konvertni ko‘radi. Bir tegish — qopqoq ko‘tariladi, taklifnoma chiqadi va musiqa asta yangraydi.',
      'why2.h': 'Hammasi bitta sahifada',
      'why2.p': 'Sana va vaqt, jonli xarita, to‘ygacha soniyalab hisob, suratlaringiz va tanlagan musiqangiz. Mehmonga faqat havola kerak.',
      'why3.h': 'Har bir mehmonga — o‘z nomi bilan',
      'why3.p': 'Har bir mehmonga alohida nomli havola — sahifada uning ismi yozib qo‘yiladi. Istalgancha mehmon, har biri 8 000 so‘m.',
      'tpl.eyebrow': 'Katalog', 'tpl.title': 'Shablonlar — jonli namuna bilan',
      'tpl.hint': 'Kartani bosing — jonli demo yangi oynada ochiladi',
      'tpl.all': 'Barcha shablonlar', 'tpl.demo': 'Jonli demo',
      'how.eyebrow': 'Qanday ishlaydi', 'how.title': 'Uch qadam — va tayyor',
      'how1.h': 'Shablonni tanlang', 'how1.p': 'Jonli demolarni ko‘ring, yuragingizga yaqinini tanlang.',
      'how2.h': 'Ma’lumotlarni kiriting', 'how2.p': 'Telegram-botda ismlar, sana, manzil, suratlar va musiqa — 15 daqiqa kifoya.',
      'how3.h': 'Havolani ulashing', 'how3.p': 'To‘lov tasdiqlangach shaxsiy havolangiz tayyor: nvate.uz/ali-va-zebo.',
      'rev.eyebrow': 'Fikrlar', 'rev.title': 'Juftliklar nima deydi',
      'rev1.p': 'Mehmonlar konvertni ochib: «Bu qanday go‘zal!» deb yozishdi. Butun to‘y shu havoladan boshlandi.',
      'rev1.who': 'Madina & Jasur', 'rev1.where': 'Toshkent',
      'rev2.p': 'Kechqurun buyurtma berdik — ertalab havola tayyor edi. Suratlar bilan juda chiroyli chiqdi.',
      'rev2.who': 'Nilufar & Sardor', 'rev2.where': 'Samarqand',
      'rev3.p': 'Nomli taklifnomalar hammani hayratda qoldirdi. Katta xarajatsiz — shuncha e’tibor.',
      'rev3.who': 'Zuhra & Bekzod', 'rev3.where': 'Farg‘ona',
      'faq.eyebrow': 'Savol-javob', 'faq.title': 'Ko‘p so‘raladigan savollar', 'faq.more': 'Barcha savollar',
      'faq1.q': 'Narxi qancha?', 'faq1.a': 'Shablonga qarab 129 000 — 199 000 so‘m. Bir marta to‘laysiz, yashirin to‘lovlar yo‘q. Nomli havolalar — har biri 8 000 so‘m.',
      'faq2.q': 'Qanday buyurtma beraman?', 'faq2.a': 'Telegram-botda formani to‘ldirasiz: ismlar, sana, manzil, suratlar, musiqa. Administrator bog‘lanadi va to‘lovdan keyin havolani yuboradi.',
      'faq3.q': 'Havola qancha vaqt ishlaydi?', 'faq3.a': 'To‘ydan keyin ham o‘chirilmaydi — sahifa xotira sifatida saqlanib qoladi.',
      'faq4.q': 'Musiqani qanday tanlayman?', 'faq4.a': 'Katalogdan qidiring, o‘z faylingizni yuklang yoki YouTube havolasini qo‘ying. Boshlanish va tugash vaqtini ham belgilash mumkin.',
      'faq5.q': 'Nechta surat qo‘shsa bo‘ladi?', 'faq5.a': 'Shablonga qarab 1 tadan 6 tagacha. Suratlar sahifada galereya bo‘lib chiqadi.',
      'faq6.q': 'Nomli taklifnoma nima?', 'faq6.a': 'Har bir mehmon uchun alohida havola: sahifada «Hurmatli Aziz aka…» deb yoziladi. Istalgancha mehmon, har biri — 8 000 so‘m.',
      'faq7.q': 'Tug‘ilgan kunlar-chi?', 'faq7.a': 'Tez kunda! Hozircha to‘y shablonlari tayyor, tug‘ilgan kunlar yo‘lda.',
      'faq8.q': 'Xatoni tuzatsa bo‘ladimi?', 'faq8.a': 'Albatta — administratorga yozing, chop etilgunga qadar bepul tuzatamiz.',
      'final.title': 'Eng baxtli kuningiz bitta havoladan boshlansin',
      'final.lead': '15 daqiqa — va taklifnomangiz tayyor.',
      'cat.title': 'Shablonlar katalogi',
      'cat.lead': 'Har bir dizayn jonli: demoni oching va o‘z ismlaringizni tasavvur qiling.',
      'cat.note': 'Narxga hammasi kiradi: shaxsiy havola, musiqa, xarita, soniyalab hisob. Nomli havolalar — har bir mehmon uchun 8 000 so‘m.',
      'soon': 'tez kunda',
      'contact.title': 'Savol qoldimi?', 'contact.lead': 'Telegramda yozing — tez javob beramiz.', 'contact.cta': 'Telegramda yozish',
      'footer.note': '© 2026 nvate — raqamli taklifnomalar · Toshkent',
      'money': function (n) { return n.toLocaleString('ru-RU') + ' so‘m'; },
    },
    ru: {
      'nav.home': 'Главная', 'nav.templates': 'Шаблоны', 'nav.how': 'Как это работает', 'nav.faq': 'FAQ', 'nav.cta': 'Начать',
      'title.index': 'nvate — цифровые приглашения', 'title.templates': 'Шаблоны — nvate', 'title.faq': 'FAQ — nvate',
      'hero.eyebrow': 'Цифровое приглашение',
      'hero.title': 'Для самого важного дня — самое красивое приглашение',
      'hero.lead': 'Конверт открывается, звучит музыка — гости видят дату, адрес и карту в одной ссылке.',
      'hero.cta1': 'Создать приглашение', 'hero.cta2': 'Смотреть примеры',
      'hero.note': 'Свадьба · День рождения',
      'env.eyebrow': 'Приглашение', 'env.date': '19 · 09 · 2026',
      'why.eyebrow': 'Почему nvate', 'why.title': 'Не приглашение — впечатление',
      'why1.h': 'Конверт оживает',
      'why1.p': 'Гость открывает ссылку и видит конверт с печатью. Одно касание — клапан поднимается, открытка выезжает, и мягко нарастает музыка.',
      'why2.h': 'Всё на одной странице',
      'why2.p': 'Дата и время, живая карта, обратный отсчёт до секунд, ваши фото и выбранная музыка. Гостю нужна только ссылка.',
      'why3.h': 'Каждому гостю — по имени',
      'why3.p': 'Каждому гостю — отдельная именная ссылка, на странице написано его имя. Сколько угодно гостей, по 8 000 сум за каждого.',
      'tpl.eyebrow': 'Каталог', 'tpl.title': 'Шаблоны — с живым демо',
      'tpl.hint': 'Нажмите на карточку — живое демо откроется в новой вкладке',
      'tpl.all': 'Все шаблоны', 'tpl.demo': 'Живое демо',
      'how.eyebrow': 'Как это работает', 'how.title': 'Три шага — и готово',
      'how1.h': 'Выберите шаблон', 'how1.p': 'Посмотрите живые демо и выберите тот, что ближе сердцу.',
      'how2.h': 'Заполните данные', 'how2.p': 'Имена, дата, адрес, фото и музыка в Telegram-боте — хватит 15 минут.',
      'how3.h': 'Поделитесь ссылкой', 'how3.p': 'После подтверждения оплаты ваша ссылка готова: nvate.uz/ali-va-zebo.',
      'rev.eyebrow': 'Отзывы', 'rev.title': 'Что говорят пары',
      'rev1.p': 'Гости открывали конверт и писали: «Как красиво!». Вся свадьба началась с этой ссылки.',
      'rev1.who': 'Мадина и Жасур', 'rev1.where': 'Ташкент',
      'rev2.p': 'Заказали вечером — утром ссылка была готова. С фотографиями получилось очень нежно.',
      'rev2.who': 'Нилуфар и Сардор', 'rev2.where': 'Самарканд',
      'rev3.p': 'Именные приглашения удивили всех. Столько внимания — без больших затрат.',
      'rev3.who': 'Зухра и Бекзод', 'rev3.where': 'Фергана',
      'faq.eyebrow': 'Вопрос-ответ', 'faq.title': 'Частые вопросы', 'faq.more': 'Все вопросы',
      'faq1.q': 'Сколько стоит?', 'faq1.a': 'От 129 000 до 199 000 сум в зависимости от шаблона. Оплата разовая, скрытых платежей нет. Именные ссылки — по 8 000 сум за гостя.',
      'faq2.q': 'Как заказать?', 'faq2.a': 'Заполняете форму в Telegram-боте: имена, дата, адрес, фото, музыка. Администратор свяжется и после оплаты пришлёт ссылку.',
      'faq3.q': 'Сколько работает ссылка?', 'faq3.a': 'Страница не удаляется и после свадьбы — остаётся как память.',
      'faq4.q': 'Как выбрать музыку?', 'faq4.a': 'Найдите трек в каталоге, загрузите свой файл или вставьте ссылку YouTube. Можно указать начало и конец отрывка.',
      'faq5.q': 'Сколько фотографий можно добавить?', 'faq5.a': 'От 1 до 6 в зависимости от шаблона. Фото становятся галереей на странице.',
      'faq6.q': 'Что такое именное приглашение?', 'faq6.a': 'Отдельная ссылка для каждого гостя: на странице написано «Уважаемый Азиз ака…». Сколько угодно гостей, по 8 000 сум за каждого.',
      'faq7.q': 'А дни рождения?', 'faq7.a': 'Скоро! Пока готовы свадебные шаблоны, дни рождения на подходе.',
      'faq8.q': 'Можно исправить ошибку?', 'faq8.a': 'Конечно — напишите администратору, до публикации исправим бесплатно.',
      'final.title': 'Пусть самый счастливый день начнётся с одной ссылки',
      'final.lead': '15 минут — и ваше приглашение готово.',
      'cat.title': 'Каталог шаблонов',
      'cat.lead': 'Каждый дизайн живой: откройте демо и представьте свои имена.',
      'cat.note': 'В цену входит всё: личная ссылка, музыка, карта, обратный отсчёт. Именные ссылки — по 8 000 сум за гостя.',
      'soon': 'скоро',
      'contact.title': 'Остались вопросы?', 'contact.lead': 'Напишите в Telegram — быстро ответим.', 'contact.cta': 'Написать в Telegram',
      'footer.note': '© 2026 nvate — цифровые приглашения · Ташкент',
      'money': function (n) { return n.toLocaleString('ru-RU') + ' сум'; },
    },
  };

  var lang = localStorage.getItem('nvate-lang');
  if (lang !== 'ru' && lang !== 'uz') lang = 'uz';

  function t(key) {
    var v = I18N[lang][key];
    return v == null ? key : v;
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    var page = document.body.getAttribute('data-page') || 'index';
    document.title = t('title.' + page);
    document.querySelectorAll('.lang-switch button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === lang);
    });
    renderTemplates();
    renderChips();
  }

  document.querySelectorAll('.lang-switch button').forEach(function (b) {
    b.addEventListener('click', function () {
      lang = b.getAttribute('data-lang');
      localStorage.setItem('nvate-lang', lang);
      applyLang();
    });
  });

  /* ---------- Навбар ---------- */
  var nav = document.querySelector('.nav');
  function onScroll() { nav && nav.classList.toggle('scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = document.querySelector('.burger');
  var links = document.querySelector('.nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('openm');
      burger.classList.toggle('x', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('openm'); burger.classList.remove('x'); });
    });
  }

  /* ---------- Появление при скролле ---------- */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function observeReveals(root) {
    var els = (root || document).querySelectorAll('.rv:not(.in)');
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- FAQ аккордеон ---------- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.setAttribute('aria-expanded', 'false');
    q.addEventListener('click', function () {
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
      a.style.maxHeight = open ? a.scrollHeight + 'px' : '0';
    });
  });

  /* ---------- Живой каталог из /api/config ---------- */
  var CONFIG = null;
  var activeEvent = 'wedding';

  function money(n) { return I18N[lang].money(n); }

  function tplCard(tp) {
    var c = tp.colors && tp.colors.length ? tp.colors : ['#F4EFF7', '#755C97', '#C6AD7C'];
    var bg = c[0], main = c[1] || '#755C97', sub = c[2] || main;
    var a = document.createElement('a');
    a.className = 'tpl-card rv';
    a.href = tp.demoUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML =
      '<div class="tpl-preview" style="background-color:' + bg + '">' +
        '<div class="tp-eyebrow" style="color:' + sub + '">' + t('env.eyebrow') + '</div>' +
        '<div class="tp-names" style="color:' + main + '">Ali <span class="tp-amp">&amp;</span> Zebo</div>' +
        '<div class="tp-rule" style="background:' + sub + '"></div>' +
        '<div class="tp-date" style="color:' + sub + '">19 · 09 · 2026</div>' +
      '</div>' +
      '<div class="tpl-meta"><b></b><span class="price"></span></div>';
    a.querySelector('.tpl-meta b').textContent = tp.name;
    a.querySelector('.price').textContent = money(tp.price);
    return a;
  }

  function renderTemplates() {
    if (!CONFIG) return;
    var strip = document.getElementById('tplStrip');
    var grid = document.getElementById('tplGrid');
    var list = CONFIG.templates.filter(function (tp) { return !grid || tp.event === activeEvent; });
    [strip, grid].forEach(function (box) {
      if (!box) return;
      box.innerHTML = '';
      list.forEach(function (tp, i) {
        var card = tplCard(tp);
        card.style.setProperty('--d', (i * .08) + 's');
        if (box === grid) {
          var act = document.createElement('div');
          act.className = 'tpl-actions';
          act.innerHTML = '<span class="btn btn-ghost btn-small">' + t('tpl.demo') + '</span>';
          card.appendChild(act);
        }
        box.appendChild(card);
      });
      observeReveals(box);
    });
  }

  function renderChips() {
    var box = document.getElementById('eventChips');
    if (!box || !CONFIG) return;
    box.innerHTML = '';
    CONFIG.events.forEach(function (ev) {
      var b = document.createElement('button');
      b.className = 'chip' + (ev.id === activeEvent ? ' on' : '');
      b.textContent = (ev.emoji ? ev.emoji + ' ' : '') + (lang === 'ru' ? ev.ru : ev.uz);
      if (!ev.active) {
        b.disabled = true;
        var s = document.createElement('span');
        s.className = 'soon';
        s.textContent = t('soon');
        b.appendChild(s);
      } else {
        b.addEventListener('click', function () {
          activeEvent = ev.id;
          renderChips();
          renderTemplates();
        });
      }
      box.appendChild(b);
    });
  }

  fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
    CONFIG = cfg;
    if (cfg.botUrl) {
      document.querySelectorAll('[data-bot-link]').forEach(function (el) { el.href = cfg.botUrl; });
    }
    renderTemplates();
    renderChips();
  }).catch(function () { /* каталог просто не отрисуется — остальной сайт работает */ });

  /* ---------- Живая атмосфера: лепестки двух пород, золотые листья,
     мерцающие искры, боке-огни и золотая пыль — богато, но медленно ---------- */
  function ambient() {
    if (reduce) return;
    var box = document.createElement('div');
    box.className = 'amb';
    box.setAttribute('aria-hidden', 'true');
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    function spawn(cls, n, make) {
      for (var i = 0; i < n; i++) {
        var el = document.createElement('i');
        el.className = cls;
        make(el, i);
        box.appendChild(el);
      }
    }
    // Розовые и белые лепестки — падают, покачиваясь
    spawn('fpetal', 10, function (el) {
      el.style.setProperty('--x', rnd(2, 96).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.7, 1.5).toFixed(2));
      el.style.setProperty('--sw', rnd(-70, 70).toFixed(0) + 'px');
      el.style.setProperty('--t', rnd(16, 30).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 22).toFixed(1) + 's');
    });
    spawn('fpetal fpetal--white', 6, function (el) {
      el.style.setProperty('--x', rnd(2, 96).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.6, 1.2).toFixed(2));
      el.style.setProperty('--sw', rnd(-60, 60).toFixed(0) + 'px');
      el.style.setProperty('--t', rnd(20, 34).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 26).toFixed(1) + 's');
    });
    // Золотые листья
    spawn('fleaf', 7, function (el) {
      el.style.setProperty('--x', rnd(2, 96).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.7, 1.4).toFixed(2));
      el.style.setProperty('--sw', rnd(-90, 90).toFixed(0) + 'px');
      el.style.setProperty('--t', rnd(18, 32).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 24).toFixed(1) + 's');
    });
    // Золотая пыль поднимается
    spawn('dust', 14, function (el) {
      el.style.setProperty('--x', rnd(2, 98).toFixed(1) + '%');
      el.style.setProperty('--y', rnd(20, 95).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.6, 1.8).toFixed(2));
      el.style.setProperty('--sw', rnd(-40, 40).toFixed(0) + 'px');
      el.style.setProperty('--t', rnd(9, 16).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 10).toFixed(1) + 's');
    });
    // Искры мерцают
    spawn('spark', 14, function (el) {
      el.style.setProperty('--x', rnd(2, 98).toFixed(1) + '%');
      el.style.setProperty('--y', rnd(6, 92).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.5, 1.4).toFixed(2));
      el.style.setProperty('--t', rnd(4, 9).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 8).toFixed(1) + 's');
    });
    // Боке-огни в глубине
    spawn('bokeh', 6, function (el) {
      el.style.setProperty('--x', rnd(4, 92).toFixed(1) + '%');
      el.style.setProperty('--y', rnd(10, 85).toFixed(1) + '%');
      el.style.setProperty('--s', rnd(.6, 1.8).toFixed(2));
      el.style.setProperty('--sw', rnd(-30, 30).toFixed(0) + 'px');
      el.style.setProperty('--t', rnd(12, 22).toFixed(1) + 's');
      el.style.setProperty('--d', rnd(0, 12).toFixed(1) + 's');
    });
    document.body.appendChild(box);
  }
  ambient();

  /* ---------- Живой конверт: тап на мобильном + автопоказ при появлении ---------- */
  var menv = document.getElementById('menv');
  if (menv) {
    menv.addEventListener('click', function () { menv.classList.toggle('open'); });
    menv.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menv.classList.toggle('open'); }
    });
    if (!reduce && 'IntersectionObserver' in window) {
      var shown = false;
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting || shown) return;
        shown = true;
        io.disconnect();
        setTimeout(function () { menv.classList.add('open'); }, 900);
        setTimeout(function () { menv.classList.remove('open'); }, 3600);
      }, { threshold: .5 });
      io.observe(menv);
    }
  }

  applyLang();
  observeReveals(document);
})();
