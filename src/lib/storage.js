// Where the chat history (chats, Saved replies, usage numbers) is kept.
//
//  - Normal mode: localStorage. History stays in this browser until you delete it, like ChatGPT.
//  - Guest mode:  sessionStorage. History lives in this one tab only and is erased when the tab is closed,
//                 so every new visitor of a public site starts with a clean, empty app.
//
// Nobody can ever see another person's chats: nothing is stored on the server, only in the visitor's own browser.
//
// Guest mode is switched on by itself on a deployed site (any address that is not your own computer),
// and stays off on localhost, so your own history is kept while you build the app.
// To force it either way, set VITE_GUEST_MODE=on or VITE_GUEST_MODE=off (in .env, or in Vercel > Environment
// Variables, then redeploy). Settings such as dark/light theme are not history and always stay in localStorage.

// Browsers only offer crypto.randomUUID() on https and on localhost. Opened over plain http (for example from your
// phone at http://192.168.x.x:5173) it is missing and sending a message would fail, so give it a stand-in.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = () => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;   // version 4
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

const flag = String(import.meta.env.VITE_GUEST_MODE ?? '').trim().toLowerCase();

// localhost, 127.x, the private network ranges (to test from a phone on your Wi-Fi) and *.local names.
const OWN_COMPUTER = /^(localhost|\[::1\]|127\.[\d.]+|10\.[\d.]+|192\.168\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+|[^.]+\.local)$/i;

export const GUEST = flag === 'on' ? true : flag === 'off' ? false : !OWN_COMPUTER.test(location.hostname);

// A tiny stand-in with the same methods, used only if the browser blocks storage completely (some private modes).
function memoryStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function open(name) {
  try {
    const s = window[name];
    void s.length;   // throws if the browser blocks storage
    return s;
  } catch {
    return memoryStore();
  }
}

export const store = open(GUEST ? 'sessionStorage' : 'localStorage');