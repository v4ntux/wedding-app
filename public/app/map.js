/* Карта студии и админки — своя, на растровых тайлах.

   Чужие виджеты (Яндекс, Google) приносят собственную панель: линейку, компас,
   «моё местоположение», флажок жалобы. Убрать их из чужого iframe нельзя, а
   паре они не нужны ни разу. Поэтому карта тут своя: тайлы, метки, перетаскивание
   пальцем, щипок и ровно две кнопки — плюс и минус.

   Ключей не требует. Источник тайлов задаётся сервером (`mapTiles` в /api/config),
   по умолчанию — OpenStreetMap; на нём же держится обязательная подпись.

   NvMap.create(el, opts) → карта. Методы: setView, setPins, setMark, clearMark,
   fit, invalidate, destroy. */
'use strict';

window.NvMap = (function () {
  const TILE = 256;
  const MIN_Z = 3;
  const MAX_Z = 19;
  const DEFAULT_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ── Проекция Web Mercator: широта/долгота ↔ пиксели мира ── */

  function project(lat, lng, z) {
    const scale = TILE * 2 ** z;
    const s = Math.sin(clamp(lat, -85.05, 85.05) * Math.PI / 180);
    return {
      x: (lng + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
    };
  }

  function unproject(x, y, z) {
    const scale = TILE * 2 ** z;
    const n = Math.PI - 2 * Math.PI * y / scale;
    return {
      lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
      lng: x / scale * 360 - 180,
    };
  }

  function svg(paths, cls) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 20 20');
    node.setAttribute('aria-hidden', 'true');
    if (cls) node.setAttribute('class', cls);
    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      node.appendChild(path);
    }
    return node;
  }

  function create(host, options = {}) {
    const opts = {
      lat: 42.116169,
      lng: 60.0625143,
      zoom: 14,
      minZoom: MIN_Z,
      maxZoom: MAX_Z,
      tiles: DEFAULT_TILES,
      credit: '© OpenStreetMap',
      creditHref: 'https://www.openstreetmap.org/copyright',
      onPin: null,        // (pin) => void — тап по метке
      onPick: null,       // ({lat,lng}) => void — тап по карте в режиме выбора
      pick: false,        // режим «поставить точку»
      ...options,
    };
    // Спред кладёт в объект и явные undefined: `{tiles: undefined}` затирал бы
    // значение по умолчанию. Поэтому обязательные поля добираем после слияния.
    opts.tiles = opts.tiles || DEFAULT_TILES;
    opts.credit = opts.credit ?? '© OpenStreetMap';
    opts.creditHref = opts.creditHref || 'https://www.openstreetmap.org/copyright';
    opts.minZoom = Number.isFinite(opts.minZoom) ? opts.minZoom : MIN_Z;
    opts.maxZoom = Number.isFinite(opts.maxZoom) ? opts.maxZoom : MAX_Z;
    if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) { opts.lat = 42.116169; opts.lng = 60.0625143; }
    if (!Number.isFinite(opts.zoom)) opts.zoom = 14;

    let zoom = clamp(Math.round(opts.zoom), opts.minZoom, opts.maxZoom);
    let centre = { lat: opts.lat, lng: opts.lng };
    let pins = [];
    let mark = null;
    let dead = false;

    host.classList.add('nvmap');
    host.innerHTML = '';

    const world = document.createElement('div');
    world.className = 'nvmap-world';
    const tileLayer = document.createElement('div');
    tileLayer.className = 'nvmap-tiles';
    const pinLayer = document.createElement('div');
    pinLayer.className = 'nvmap-pins';
    world.append(tileLayer, pinLayer);

    const zoomBox = document.createElement('div');
    zoomBox.className = 'nvmap-zoom';
    const zoomIn = document.createElement('button');
    zoomIn.type = 'button';
    zoomIn.className = 'nvmap-btn';
    zoomIn.appendChild(svg(['M10 4v12', 'M4 10h12']));
    const zoomOut = document.createElement('button');
    zoomOut.type = 'button';
    zoomOut.className = 'nvmap-btn';
    zoomOut.appendChild(svg(['M4 10h12']));
    zoomBox.append(zoomIn, zoomOut);

    const credit = document.createElement('a');
    credit.className = 'nvmap-credit';
    credit.href = opts.creditHref;
    credit.target = '_blank';
    credit.rel = 'noopener noreferrer';
    credit.textContent = opts.credit;

    host.append(world, zoomBox, credit);

    /* ── Тайлы ──────────────────────────────────────────────────────────
       Плитки переиспользуем по ключу z/x/y: при перетаскивании меняется
       только рамка видимых ключей, а уже загруженные картинки остаются на
       месте и не мигают. */

    const live = new Map();

    const tileUrl = (z, x, y) => opts.tiles
      .replace('{z}', z).replace('{x}', x).replace('{y}', y);

    function topLeft() {
      const c = project(centre.lat, centre.lng, zoom);
      return { x: c.x - host.clientWidth / 2, y: c.y - host.clientHeight / 2 };
    }

    function drawTiles() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      const origin = topLeft();
      const span = 2 ** zoom;
      // Кольцо запаса вокруг экрана: при протяжке пальцем край не оголяется.
      const pad = 1;
      const x0 = Math.floor(origin.x / TILE) - pad;
      const y0 = Math.floor(origin.y / TILE) - pad;
      const x1 = Math.floor((origin.x + w) / TILE) + pad;
      const y1 = Math.floor((origin.y + h) / TILE) + pad;
      const keep = new Set();

      for (let x = x0; x <= x1; x += 1) {
        for (let y = y0; y <= y1; y += 1) {
          if (y < 0 || y >= span) continue;                 // за полюсами тайлов нет
          const wrapped = ((x % span) + span) % span;        // а по долготе мир замкнут
          const key = `${zoom}/${wrapped}/${y}@${x}`;
          keep.add(key);
          let img = live.get(key);
          if (!img) {
            img = new Image();
            img.className = 'nvmap-tile';
            img.decoding = 'async';
            img.loading = 'eager';
            img.alt = '';
            img.draggable = false;
            img.addEventListener('load', () => img.classList.add('is-on'));
            img.addEventListener('error', () => img.classList.add('is-off'));
            img.src = tileUrl(zoom, wrapped, y);
            live.set(key, img);
            tileLayer.appendChild(img);
          }
          img.style.transform = `translate3d(${x * TILE - origin.x}px, ${y * TILE - origin.y}px, 0)`;
        }
      }

      for (const [key, img] of live) {
        if (keep.has(key)) continue;
        img.remove();
        live.delete(key);
      }
    }

    /* ── Метки ── */

    function pinNode(pin) {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `nvmap-pin${pin.active ? ' is-active' : ''}`;
      node.dataset.id = pin.id ?? '';
      const dot = document.createElement('span');
      dot.className = 'nvmap-dot';
      node.appendChild(dot);
      if (pin.label) {
        const label = document.createElement('span');
        label.className = 'nvmap-label';
        label.textContent = pin.label;
        node.appendChild(label);
      }
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        opts.onPin?.(pin);
      });
      return node;
    }

    function drawPins() {
      const origin = topLeft();
      pinLayer.innerHTML = '';
      for (const pin of pins) {
        if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
        const p = project(pin.lat, pin.lng, zoom);
        const node = pinNode(pin);
        node.style.transform = `translate3d(${p.x - origin.x}px, ${p.y - origin.y}px, 0)`;
        pinLayer.appendChild(node);
      }
      if (mark && Number.isFinite(mark.lat)) {
        const p = project(mark.lat, mark.lng, zoom);
        const node = document.createElement('span');
        node.className = 'nvmap-mark';
        node.style.transform = `translate3d(${p.x - origin.x}px, ${p.y - origin.y}px, 0)`;
        pinLayer.appendChild(node);
      }
    }

    function draw() {
      if (dead) return;
      drawTiles();
      drawPins();
    }

    /* ── Перетаскивание и щипок ───────────────────────────────────────────
       Пока палец ведёт, двигаем слой трансформой — это работа видеокарты, а
       не перерисовка. Как только смещение перевалит за половину плитки,
       фиксируем центр и дорисовываем тайлы: край не успевает оголиться. */

    let drag = null;
    let pinch = null;
    const points = new Map();
    let offset = { x: 0, y: 0 };
    let scale = 1;
    let scaleOrigin = null;

    function applyTransform() {
      const anchor = scaleOrigin;
      world.style.transformOrigin = anchor ? `${anchor.x}px ${anchor.y}px` : '50% 50%';
      world.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`;
    }

    function commitOffset() {
      if (!offset.x && !offset.y) return;
      const c = project(centre.lat, centre.lng, zoom);
      centre = unproject(c.x - offset.x, c.y - offset.y, zoom);
      offset = { x: 0, y: 0 };
      applyTransform();
      draw();
    }

    function onDown(event) {
      if (event.button === 2) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      // Захват указателя — удобство, а не условие работы: если палец уже
      // отпущен (или событие пришло синтетическим), браузер бросает
      // NotFoundError, и без страховки он бы унёс с собой весь обработчик.
      try { host.setPointerCapture?.(event.pointerId); } catch (_) { /* — */ }
      if (points.size === 1) {
        drag = { x: event.clientX, y: event.clientY, moved: 0, at: Date.now() };
        world.classList.add('is-dragging');
      } else if (points.size === 2) {
        const [a, b] = [...points.values()];
        drag = null;
        pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          mid: hostPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
        };
      }
    }

    function hostPoint(clientX, clientY) {
      const box = host.getBoundingClientRect();
      return { x: clientX - box.left, y: clientY - box.top };
    }

    function onMove(event) {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinch && points.size >= 2) {
        const [a, b] = [...points.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        scale = clamp(distance / pinch.distance, 0.35, 3.2);
        scaleOrigin = pinch.mid;
        applyTransform();
        return;
      }

      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      offset = { x: offset.x + dx, y: offset.y + dy };
      drag.x = event.clientX;
      drag.y = event.clientY;
      applyTransform();
      if (Math.abs(offset.x) > TILE / 2 || Math.abs(offset.y) > TILE / 2) commitOffset();
    }

    function onUp(event) {
      points.delete(event.pointerId);
      try { host.releasePointerCapture?.(event.pointerId); } catch (_) { /* — */ }

      if (pinch && points.size < 2) {
        // Щипок отпустили — приводим к ближайшему целому масштабу.
        const steps = Math.round(Math.log2(scale));
        const at = scaleOrigin;
        scale = 1;
        scaleOrigin = null;
        pinch = null;
        applyTransform();
        if (steps) zoomBy(steps, at);
        else draw();
        return;
      }

      if (!drag) return;
      const quick = drag.moved < 6 && Date.now() - drag.at < 420;
      const wasDrag = drag;
      drag = null;
      world.classList.remove('is-dragging');
      commitOffset();
      // Короткий тап без протяжки — это выбор точки, а не перетаскивание.
      if (quick && opts.pick && !event.target.closest('.nvmap-pin, .nvmap-btn, .nvmap-credit')) {
        const at = hostPoint(wasDrag.x, wasDrag.y);
        const origin = topLeft();
        opts.onPick?.(unproject(origin.x + at.x, origin.y + at.y, zoom));
      }
    }

    function zoomBy(steps, at = null) {
      const next = clamp(zoom + steps, opts.minZoom, opts.maxZoom);
      if (next === zoom) { draw(); return; }
      // Приближаем к точке под пальцем, а не к центру экрана.
      if (at) {
        const origin = topLeft();
        const target = unproject(origin.x + at.x, origin.y + at.y, zoom);
        const k = 2 ** (next - zoom);
        const c = project(centre.lat, centre.lng, zoom);
        const p = project(target.lat, target.lng, zoom);
        const moved = { x: p.x + (c.x - p.x) / k, y: p.y + (c.y - p.y) / k };
        centre = unproject(moved.x, moved.y, zoom);
      }
      zoom = next;
      draw();
    }

    /* ── Плавный перелёт: и центр, и масштаб едут вместе ── */

    let flight = 0;

    function flyTo(lat, lng, toZoom = zoom, ms = 700) {
      const run = ++flight;
      const fromZoom = zoom;
      const target = clamp(Math.round(toZoom), opts.minZoom, opts.maxZoom);
      const from = { ...centre };
      if (!ms) { centre = { lat, lng }; zoom = target; draw(); return; }
      const t0 = performance.now();
      const step = (now) => {
        if (run !== flight || dead) return;
        const k = clamp((now - t0) / ms, 0, 1);
        const e = 1 - (1 - k) ** 3;
        centre = { lat: from.lat + (lat - from.lat) * e, lng: from.lng + (lng - from.lng) * e };
        const z = Math.round(fromZoom + (target - fromZoom) * e);
        if (z !== zoom) zoom = z;
        draw();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    /* ── События ── */

    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);
    host.addEventListener('contextmenu', (e) => e.preventDefault());
    host.addEventListener('dblclick', (event) => {
      event.preventDefault();
      zoomBy(1, hostPoint(event.clientX, event.clientY));
    });
    host.addEventListener('wheel', (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1, hostPoint(event.clientX, event.clientY));
    }, { passive: false });

    zoomIn.addEventListener('click', (e) => { e.stopPropagation(); zoomBy(1); });
    zoomOut.addEventListener('click', (e) => { e.stopPropagation(); zoomBy(-1); });

    const observer = 'ResizeObserver' in window ? new ResizeObserver(() => draw()) : null;
    observer?.observe(host);

    requestAnimationFrame(draw);
    draw();

    return {
      setView(lat, lng, z = zoom, ms = 700) { flyTo(lat, lng, z, ms); },
      jumpTo(lat, lng, z = zoom) { flight += 1; centre = { lat, lng }; zoom = clamp(Math.round(z), opts.minZoom, opts.maxZoom); draw(); },
      setPins(list) { pins = Array.isArray(list) ? list : []; drawPins(); },
      setMark(lat, lng) { mark = Number.isFinite(lat) ? { lat, lng } : null; drawPins(); },
      clearMark() { mark = null; drawPins(); },
      setPick(on) { opts.pick = Boolean(on); host.classList.toggle('is-picking', Boolean(on)); },
      centre() { return { ...centre }; },
      zoom() { return zoom; },
      /* Вмещаем все метки в экран: иначе на пустом каталоге карта показывает
         город, а на широком — половину меток за краем. */
      fit(list = pins, padding = 0.35) {
        const spots = list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (!spots.length) return;
        if (spots.length === 1) { this.jumpTo(spots[0].lat, spots[0].lng, 16); return; }
        const lats = spots.map((p) => p.lat);
        const lngs = spots.map((p) => p.lng);
        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        let best = opts.minZoom;
        for (let z = opts.maxZoom; z >= opts.minZoom; z -= 1) {
          const a = project(Math.min(...lats), Math.min(...lngs), z);
          const b = project(Math.max(...lats), Math.max(...lngs), z);
          if (Math.abs(b.x - a.x) <= host.clientWidth * (1 - padding)
            && Math.abs(b.y - a.y) <= host.clientHeight * (1 - padding)) { best = z; break; }
        }
        this.jumpTo(midLat, midLng, best);
      },
      invalidate() { draw(); },
      destroy() {
        dead = true;
        observer?.disconnect();
        host.innerHTML = '';
        host.classList.remove('nvmap');
        live.clear();
      },
    };
  }

  return { create, project, unproject };
})();
