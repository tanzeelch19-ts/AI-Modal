// Chat names, like ChatGPT: every conversation gets its own short, unique name.
//  1. quickTitle()  - instant name made from the first message (shown right away)
//  2. fetchAiTitle() - after the first reply, the AI writes a nicer 2-5 word name (replaces the quick one)
//  3. uniqueTitle() - if a name is already used, "Name (2)", "Name (3)" ... is used

const MAX = 40;
const AUTO_TEXT = /^(Describe what happens in this video|Describe this image|Please review the attached file)/;

// Cut at a word boundary and add "…" when the text is longer than n.
function shorten(text, n = MAX) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const space = cut.lastIndexOf(' ');
  return (space > n * 0.5 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '') + '…';
}

const capital = (t) => t[0].toUpperCase() + t.slice(1);

export function quickTitle(text, att) {
  const raw = String(text || '');
  const first = att?.[0]?.name;
  if (first && AUTO_TEXT.test(raw)) {
    const name = shorten(first.replace(/\.[^.]+$/, ''));
    return name ? capital(name) : 'Attachment';
  }
  const t = shorten(raw.replace(/```[\w+-]*/g, ' ').replace(/[#*_`>~|]/g, ' '));
  return t ? capital(t) : 'New chat';
}

// `list` is the chat index [{ id, title }]; the chat `ownId` itself is ignored.
export function uniqueTitle(title, list, ownId) {
  const taken = new Set(list.filter((e) => e.id !== ownId).map((e) => String(e.title).toLowerCase()));
  const base = title || 'New chat';
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const t = `${base} (${n})`;
    if (!taken.has(t.toLowerCase())) return t;
  }
}

// The AI sometimes adds quotes, "Title:" or a full stop. Returns '' when nothing usable is left.
export function cleanAiTitle(raw) {
  let t = String(raw || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
  t = t
    .replace(/^(chat title|title|name)\s*[:\-–]\s*/i, '')
    .replace(/^["'“”‘’`*#\s]+|["'“”‘’`*\s]+$/g, '')
    .replace(/[.。!]+$/, '')
    .trim();
  return t.length < 2 ? '' : shorten(t, 48);
}

// Asks the server for a short name. Never throws: on any problem it returns '' and the quick name stays.
export async function fetchAiTitle(user, reply) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch('/api/title', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-access-code': localStorage.getItem('devai:code') || '' },
      body: JSON.stringify({ user: String(user || '').slice(0, 600), reply: String(reply || '').slice(0, 600) }),
    });
    if (!res.ok) return '';
    return cleanAiTitle((await res.json()).title);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}