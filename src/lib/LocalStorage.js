import { useEffect, useRef, useState } from 'react';

// Like useState, but the value is saved in localStorage under `key`.
// Saving is delayed a little (debounced) so a streaming reply, which changes the value
// many times per second, does not re-write all chats to storage on every update.
export function LocalStorage(key, init) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch {
      return init;
    }
  });
  const latest = useRef(v);

  useEffect(() => {
    latest.current = v;
    const t = setTimeout(save, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);

  // Save right away when the tab is closed or hidden, so the last 400 ms is not lost.
  useEffect(() => {
    addEventListener('pagehide', save);
    return () => removeEventListener('pagehide', save);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function save() {
    try { localStorage.setItem(key, JSON.stringify(latest.current)); } catch { /* storage full */ }
  }

  return [v, setV];
}