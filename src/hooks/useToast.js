import { useCallback, useRef, useState } from 'react';

// Small message at the bottom of the screen that hides itself after a few seconds.
export function useToast() {
  const [note, setNote] = useState('');
  const timer = useRef(0);
  const toast = useCallback((m) => {
    setNote(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(''), 3800);
  }, []);
  return { note, toast };
}