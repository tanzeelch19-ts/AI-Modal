import { useEffect } from 'react';

// Keep the scrolling area at the bottom, unless the user has scrolled up to read.
export function useAutoScroll(ref, deps) {
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}