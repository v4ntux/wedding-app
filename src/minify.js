/* Ластик для студии. Сборщика у проекта нет, поэтому лёгкость делаем сами.

   Студию пишут для людей: с подробными русскими комментариями и отступами.
   Браузеру это не нужно, а по сети оно едет. Кириллица в UTF-8 — два байта
   на букву и почти не жмётся, так что даже после brotli пояснения — это
   четверть веса app.js, style.css и разметки.

   Ластик убирает только то, что читает человек: комментарии, отступы, пустые
   строки. Имена, выражения и переводы строк в JS остаются на месте — это не
   сборщик, и ASI работает ровно как в исходнике. Страховка: стёртый JS обязан
   компилироваться в V8, иначе наружу уходит исходник. */

import vm from 'node:vm';

/* Версия правил ластика. Входит в тег сборки и ETag: поменялись правила —
   браузер не станет вечно держать файл, стёртый прежней версией. */
export const MINIFY_REVISION = '1';

function quoted(text, start) {
  const quote = text[start];
  for (let j = start + 1; j < text.length; j += 1) {
    const c = text[j];
    if (c === '\\') { j += text[j + 1] === '\r' && text[j + 2] === '\n' ? 2 : 1; continue; }
    if (c === quote) return j + 1;
    if (c === '\n' || c === '\r') return -1;
  }
  return -1;
}

/* ════ CSS ════ */

const CSS_SPACE = new Set([' ', '\t', '\n', '\r', '\f']);
// Вокруг этих знаков пробел ничего не значит. Двоеточия здесь нет:
// `a :hover` и `a:hover` — разные селекторы.
const CSS_BARE = new Set(['{', '}', ';', ',']);

export function minifyCss(css) {
  const out = [];
  let last = '';
  let gap = false;
  let semi = false;
  const put = (chunk) => {
    // Скобку прижимаем только изнутри: `and (` без пробела стало бы функцией.
    if (gap && last && !CSS_BARE.has(last) && last !== '(' && !CSS_BARE.has(chunk[0]) && chunk[0] !== ')') out.push(' ');
    out.push(chunk);
    last = chunk[chunk.length - 1];
    gap = false;
    semi = false;
  };

  for (let i = 0; i < css.length;) {
    const ch = css[i];
    if (CSS_SPACE.has(ch)) { gap = true; i += 1; continue; }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0) return css;
      gap = true;
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = quoted(css, i);
      if (end < 0) return css;
      put(css.slice(i, end));
      i = end;
      continue;
    }
    if (ch === '\\') { put(css.slice(i, i + 2)); i += 2; continue; }
    // url(...) без кавычек — одна лексема, внутри неё ничего не трогаем.
    if ((ch === 'u' || ch === 'U') && (gap || !/[\w-]/.test(last)) && css.slice(i, i + 4).toLowerCase() === 'url(') {
      let j = i + 4;
      while (CSS_SPACE.has(css[j])) j += 1;
      if (css[j] !== '"' && css[j] !== "'") {
        const end = css.indexOf(')', j);
        if (end < 0) return css;
        put(css.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    // Точка с запятой перед закрывающей скобкой лишняя.
    if (ch === '}' && semi) {
      out.pop();
      last = out.length ? out[out.length - 1].slice(-1) : '';
    }
    put(ch);
    semi = ch === ';';
    i += 1;
  }
  return out.join('');
}

/* ════ JS ════ */

const char = (code) => String.fromCharCode(code);
const JS_SPACE = new Set([' ', '\t', '\v', '\f', char(0xa0), char(0xfeff)]);
const LINE_END = new Set(['\n', '\r', char(0x2028), char(0x2029)]);
// Всё, что выше ASCII, в коде студии бывает только частью имени.
const isWord = (ch) => /[\w$#]/.test(ch) || ch.charCodeAt(0) >= 0x80;
// После этих слов косая черта открывает регулярное выражение, а не деление.
const BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

const compiles = (code) => {
  try { new vm.Script(code); return true; } catch { return false; }
};

export function minifyJs(source) {
  if (!compiles(source)) return source;
  const out = stripJs(source);
  return out !== null && compiles(out) ? out : source;
}

function stripJs(src) {
  const out = [];
  const depth = [];     // открытые ${…}: сколько фигурных скобок внутри каждой
  let gap = '';         // что стояло между токенами: ничего, пробел или перевод строки
  let regexOk = true;   // может ли здесь начаться /регулярка/
  let prev = '';

  const put = (token) => {
    if (gap && out.length) out.push(gap);
    out.push(token);
    gap = '';
    prev = token;
  };

  for (let i = 0; i < src.length;) {
    const ch = src[i];

    if (LINE_END.has(ch)) { gap = '\n'; i += 1; continue; }
    if (JS_SPACE.has(ch)) { gap ||= ' '; i += 1; continue; }

    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && !LINE_END.has(src[i])) i += 1;
      gap ||= ' ';
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) return null;
      // Перевод строки внутри комментария для ASI — такой же перевод строки.
      let multiline = false;
      for (let k = i + 2; k < end && !multiline; k += 1) multiline = LINE_END.has(src[k]);
      if (multiline) gap = '\n';
      else gap ||= ' ';
      i = end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const end = quoted(src, i);
      if (end < 0) return null;
      put(src.slice(i, end));
      regexOk = false;
      i = end;
      continue;
    }

    // Текст шаблонной строки: от ` или от `}`, закрывающей ${…}, до ` или ${.
    if (ch === '`' || (ch === '}' && depth.length && depth[depth.length - 1] === 0)) {
      if (ch === '}') depth.pop();
      let j = i + 1;
      while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
      if (j >= src.length) return null;
      if (src[j] === '`') {
        put(src.slice(i, j + 1));
        regexOk = false;
        i = j + 1;
      } else {
        put(src.slice(i, j + 2));
        depth.push(0);
        regexOk = true;
        i = j + 2;
      }
      continue;
    }

    if (ch === '/' && regexOk) {
      let j = i + 1;
      let inClass = false;
      for (; j < src.length; j += 1) {
        const c = src[j];
        if (c === '\\') { j += 1; continue; }
        if (LINE_END.has(c)) return null;
        if (inClass) { if (c === ']') inClass = false; }
        else if (c === '[') inClass = true;
        else if (c === '/') break;
      }
      if (j >= src.length) return null;
      j += 1;
      while (j < src.length && /[a-z]/i.test(src[j])) j += 1;
      put(src.slice(i, j));
      regexOk = false;
      i = j;
      continue;
    }

    if (isWord(ch)) {
      let j = i + 1;
      while (j < src.length && isWord(src[j]) && !LINE_END.has(src[j]) && !JS_SPACE.has(src[j])) j += 1;
      const word = src.slice(i, j);
      const property = prev === '.';   // obj.in / 2 — это свойство, а не оператор
      put(word);
      regexOk = !property && BEFORE_REGEX.has(word);
      i = j;
      continue;
    }

    if (depth.length && ch === '{') depth[depth.length - 1] += 1;
    if (depth.length && ch === '}') depth[depth.length - 1] -= 1;
    const doubled = (ch === '+' || ch === '-') && prev === ch && !gap;
    put(ch);
    // `)`, `]` и `a++` закрывают выражение: дальше косая — деление.
    regexOk = !(ch === ')' || ch === ']' || doubled);
    i += 1;
  }
  return out.join('');
}

/* ════ HTML ════ */

// Внутри этих элементов текст значим сам по себе или это вовсе не HTML.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'pre']);
const HTML_SPACE = /[ \t\n\r\f]/;

export function minifyHtml(html) {
  const lower = html.toLowerCase();
  const out = [];
  let tail = '';
  const put = (chunk) => {
    if (!chunk) return;
    out.push(chunk);
    tail = chunk[chunk.length - 1];
  };

  for (let i = 0; i < html.length;) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      if (end < 0) return html;
      i = end + 3;
      continue;
    }

    if (html[i] === '<' && /[a-z!/?]/i.test(html[i + 1] ?? '')) {
      // Тег целиком. Значения атрибутов в кавычках не трогаем.
      let tag = '<';
      let quote = '';
      let space = false;
      let j = i + 1;
      for (; j < html.length; j += 1) {
        const c = html[j];
        if (quote) { tag += c; if (c === quote) quote = ''; continue; }
        if (c === '>') break;
        if (HTML_SPACE.test(c)) { space = true; continue; }
        if (space) { tag += ' '; space = false; }
        if (c === '"' || c === "'") quote = c;
        tag += c;
      }
      if (j >= html.length) return html;
      put(`${tag}>`);
      i = j + 1;

      const name = /^<([a-z][\w-]*)/i.exec(tag)?.[1].toLowerCase();
      if (name && RAW_TEXT.has(name) && !tag.endsWith('/')) {
        const close = lower.indexOf(`</${name}`, i);
        if (close < 0) return html;
        const content = html.slice(i, close);
        put(name === 'style' ? minifyCss(content) : content);
        i = close;
      }
      continue;
    }

    // Текст: пробельный кусок с переводом строки схлопывается в один перевод.
    const next = html.indexOf('<', i + 1);
    const stop = next < 0 ? html.length : next;
    const text = html.slice(i, stop).replace(/[ \t\r\f]*\n[ \t\n\r\f]*/g, '\n');
    put(text === '\n' && tail === '\n' ? '' : text);
    i = stop;
  }
  return out.join('');
}
