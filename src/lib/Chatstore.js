// Saves conversations in the browser (localStorage), the way ChatGPT keeps its history:
//   devai:index      -> [{ id, title, ts }]  the sidebar list. Small, so the app opens instantly.
//   devai:chat:<id>  -> [messages]           one key per conversation, read only when you open it.
//   devai:usage      -> { n, in, out }
// Saving one chat never re-writes the others, so history stays fast even with hundreds of chats.
import { quickTitle, uniqueTitle } from './chatTitles';

export const INDEX_KEY = 'devai:index';
const CHAT = 'devai:chat:';
const USAGE = 'devai:usage';
const OLD_CHATS = 'devai:chats';   // old format: every chat in one big key
const OLD_CUR = 'devai:cur';

function read(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;   // storage full or blocked
  }
}

function drop(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

const byTime = (a, b) => b.ts - a.ts;

function tidy(list) {
  return list
    .filter((e) => e && typeof e.id === 'string')
    .map((e) => ({ id: e.id, title: String(e.title || 'New chat'), ts: Number(e.ts) || 0, ...(e.ai ? { ai: 1 } : {}) }))
    .sort(byTime);
}

// ---------- the list of chats (newest activity first) ----------
export function loadIndex() {
  const idx = read(INDEX_KEY, null);
  return Array.isArray(idx) ? tidy(idx) : migrate();
}

// Old versions kept all chats in one key. Move them to the new format once; nothing is lost.
function migrate() {
  const old = read(OLD_CHATS, null);
  drop(OLD_CUR);
  if (!Array.isArray(old)) return [];
  const now = Date.now();
  const list = [];
  let ok = true;
  old.forEach((c, i) => {
    const msgs = Array.isArray(c?.msgs) ? c.msgs : [];
    if (typeof c?.id !== 'string' || !msgs.length) return;
    if (!saveChat(c.id, msgs)) ok = false;
    const title = uniqueTitle(c.title ? String(c.title) : quickTitle(msgs[0]?.text, msgs[0]?.att), list, c.id);
    list.push({ id: c.id, title, ts: now - i * 1000 });   // old list was newest first: keep that order
  });
  write(INDEX_KEY, list);
  if (ok) drop(OLD_CHATS);   // if the browser ran out of space, keep the old copy (loadChat can still read it)
  return list;
}

// Create or update one entry (patch = e.g. { title, ts }) and return the new list.
export function upsertEntry(id, patch = {}) {
  const list = loadIndex();
  const old = list.find((e) => e.id === id);
  const next = { id, title: 'New chat', ts: Date.now(), ...old, ...patch };
  const out = tidy([...list.filter((e) => e.id !== id), next]);
  write(INDEX_KEY, out);
  return out;
}

export function removeEntry(id) {
  const out = loadIndex().filter((e) => e.id !== id);
  write(INDEX_KEY, out);
  return out;
}

// ---------- one conversation ----------
export function loadChat(id) {
  let msgs = read(CHAT + id, null);
  if (!Array.isArray(msgs)) {
    const old = read(OLD_CHATS, null);
    msgs = Array.isArray(old) ? old.find((c) => c?.id === id)?.msgs : null;
  }
  if (!Array.isArray(msgs)) return [];
  // The page was closed while a reply was still empty: show a Retry instead of an endless "typing".
  const last = msgs[msgs.length - 1];
  if (last?.role === 'assistant' && !last.text && !last.err) {
    return [...msgs.slice(0, -1), { ...last, text: 'This reply was interrupted. Press Retry.', err: true }];
  }
  return msgs;
}

export function saveChat(id, msgs) {
  if (write(CHAT + id, msgs)) return true;
  // Storage is full: small preview pictures are the biggest part, so drop them and try again.
  return write(CHAT + id, msgs.map((m) => (m.att?.some((a) => a.thumb) ? { ...m, att: m.att.map((a) => ({ ...a, thumb: undefined })) } : m)));
}

export function removeChat(id) {
  drop(CHAT + id);
}

// ---------- usage numbers ----------
export function loadUsage() {
  const u = read(USAGE, null);
  return { n: Number(u?.n) || 0, in: Number(u?.in) || 0, out: Number(u?.out) || 0 };
}

export function saveUsage(u) {
  write(USAGE, u);
}