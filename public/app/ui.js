/* UI kit — дизайн-система приложения: DOM-хелперы, тосты, шторка предпросмотра,
   скелетоны, count-up, дебаунс и хаптика Telegram. Без зависимостей. */
'use strict';

window.UI = (function () {
  const $ = (id) => document.getElementById(id);

  /* h('div', {class:'x', onclick:fn}, child1, 'text', ...) — сборка DOM без innerHTML */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v; // только для доверенной разметки
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* ── Хаптика Telegram: селекция, удар, итог ── */
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  const haptic = {
    tap() { try { tg?.HapticFeedback?.selectionChanged(); } catch (_) { /* вне Telegram */ } },
    impact(style = 'light') { try { tg?.HapticFeedback?.impactOccurred(style); } catch (_) { /* — */ } },
    ok() { try { tg?.HapticFeedback?.notificationOccurred('success'); } catch (_) { /* — */ } },
    warn() { try { tg?.HapticFeedback?.notificationOccurred('warning'); } catch (_) { /* — */ } },
    err() { try { tg?.HapticFeedback?.notificationOccurred('error'); } catch (_) { /* — */ } },
  };

  /* ── Тосты: единый канал ошибок/подтверждений вместо красной строки ── */
  function toast(msg, kind = 'info', ms = 3200) {
    const root = $('toasts');
    if (!root) return;
    const el = h('div', { class: `toast toast--${kind}` },
      h('span', { class: 'toast-ic' }, kind === 'err' ? '✕' : kind === 'ok' ? '✓' : '✦'),
      h('span', {}, msg));
    root.appendChild(el);
    if (kind === 'err') haptic.err(); else if (kind === 'ok') haptic.ok();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      setTimeout(() => el.remove(), 350);
    }, ms);
  }

  /* ── Полноэкранная шторка предпросмотра (live-демо и настоящий превью) ── */
  const sheet = {
    open({ src = null, srcdoc = null, actionLabel = null, onAction = null }) {
      const s = $('sheet');
      const f = $('sheet-frame');
      const act = $('sheet-action');
      f.removeAttribute('srcdoc');
      f.removeAttribute('src');
      if (srcdoc !== null) f.srcdoc = srcdoc; else if (src) f.src = src;
      if (actionLabel && onAction) {
        act.textContent = actionLabel;
        act.hidden = false;
        act.onclick = () => { sheet.close(); onAction(); };
      } else {
        act.hidden = true;
        act.onclick = null;
      }
      s.hidden = false;
      requestAnimationFrame(() => s.classList.add('in'));
      haptic.impact('light');
    },
    close() {
      const s = $('sheet');
      s.classList.remove('in');
      setTimeout(() => {
        s.hidden = true;
        const f = $('sheet-frame');
        f.removeAttribute('srcdoc');
        f.src = 'about:blank';
      }, 380);
    },
  };

  /* ── Скелетоны: мерцающие заглушки на время загрузки ── */
  function skeletons(count, cls) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) frag.appendChild(h('div', { class: `skel ${cls}` }));
    return frag;
  }

  /* ── Count-up: цифры «оживают» при появлении ── */
  function countUp(el, target, ms = 1400) {
    const t0 = performance.now();
    const fmt = (n) => n.toLocaleString('ru-RU');
    function frame(now) {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* Появление блоков при скролле */
  function revealOnScroll(selector) {
    const els = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: .15 });
    els.forEach((e) => io.observe(e));
  }

  /* Лепестки на экране успеха: генерируем поле частиц с CSS-анимацией */
  function petals(root, n = 18) {
    root.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const p = h('i', { class: 'petal' + (i % 3 === 0 ? ' petal--spark' : '') });
      p.style.setProperty('--x', Math.random() * 100 + '%');
      p.style.setProperty('--d', (Math.random() * 5).toFixed(2) + 's');
      p.style.setProperty('--t', (6 + Math.random() * 6).toFixed(2) + 's');
      p.style.setProperty('--s', (0.5 + Math.random()).toFixed(2));
      p.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
      root.appendChild(p);
    }
  }

  return { $, h, debounce, toast, sheet, skeletons, countUp, revealOnScroll, petals, haptic, tg };
})();
