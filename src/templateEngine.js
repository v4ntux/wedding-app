// Мини-движок шаблонов для файлов из templates/.
// Синтаксис: {{x}} — вставка с экранированием, {{{x}}} — как есть (для блоков движка),
// {{#if x}}...{{else}}...{{/if}}, {{#each arr}}...{{/each}} ({{this}}, {{@index}}).
// Пути с точками: {{L.sub}}, {{photos.0}}. Пустой массив в {{#if}} считается false.

export function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const TAG_RE = /\{\{\{\s*([^{}]+?)\s*\}\}\}|\{\{\s*([^{}]+?)\s*\}\}/g;

// Компилирует исходник в дерево узлов. Бросает Error при непарных блоках —
// сломанный шаблон отсеивается ещё на загрузке, а не при рендере гостю.
export function parseTemplate(src) {
  const root = { t: 'root', children: [], alt: [], inElse: false };
  const stack = [root];
  const bucket = () => {
    const n = stack[stack.length - 1];
    return n.inElse ? n.alt : n.children;
  };
  let last = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(src)) !== null) {
    if (m.index > last) bucket().push({ t: 'text', s: src.slice(last, m.index) });
    last = TAG_RE.lastIndex;
    if (m[1] !== undefined) {
      bucket().push({ t: 'raw', p: m[1] });
      continue;
    }
    const tag = m[2];
    if (tag.startsWith('#if ')) {
      const n = { t: 'if', p: tag.slice(4).trim(), children: [], alt: [], inElse: false };
      bucket().push(n);
      stack.push(n);
    } else if (tag.startsWith('#each ')) {
      const n = { t: 'each', p: tag.slice(6).trim(), children: [], alt: [], inElse: false };
      bucket().push(n);
      stack.push(n);
    } else if (tag === 'else') {
      const n = stack[stack.length - 1];
      if (n.t !== 'if') throw new Error('{{else}} вне {{#if}}');
      n.inElse = true;
    } else if (tag === '/if' || tag === '/each') {
      const n = stack.pop();
      if (!n || n.t !== tag.slice(1)) throw new Error(`непарный {{${tag}}}`);
    } else {
      bucket().push({ t: 'esc', p: tag });
    }
  }
  if (stack.length !== 1) throw new Error(`незакрытый блок {{#${stack[stack.length - 1].t}}}`);
  if (last < src.length) root.children.push({ t: 'text', s: src.slice(last) });
  return root;
}

function resolve(scopes, path) {
  const parts = path.split('.');
  let val;
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    if (s != null && typeof s === 'object' && parts[0] in s) {
      val = s[parts[0]];
      break;
    }
  }
  for (let j = 1; j < parts.length && val != null; j++) val = val[parts[j]];
  return val;
}

function truthy(v) {
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

function walk(nodes, scopes, out) {
  for (const n of nodes) {
    if (n.t === 'text') {
      out.push(n.s);
    } else if (n.t === 'esc') {
      const v = resolve(scopes, n.p);
      if (v != null) out.push(escapeHtml(v));
    } else if (n.t === 'raw') {
      const v = resolve(scopes, n.p);
      if (v != null) out.push(String(v));
    } else if (n.t === 'if') {
      walk(truthy(resolve(scopes, n.p)) ? n.children : n.alt, scopes, out);
    } else if (n.t === 'each') {
      const arr = resolve(scopes, n.p);
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, i) => {
        const scope = { this: item, '@index': i };
        if (item != null && typeof item === 'object') Object.assign(scope, item);
        walk(n.children, [...scopes, scope], out);
      });
    }
  }
}

export function renderTemplate(tree, data) {
  const out = [];
  walk(tree.children, [data], out);
  return out.join('');
}
