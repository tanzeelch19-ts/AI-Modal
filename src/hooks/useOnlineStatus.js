import { useEffect, useRef, useState } from 'react';

export function useOnlineStatus(onBackOnline) {
  const [online, setOnline] = useState(navigator.onLine);
  const cb = useRef(onBackOnline);
  useEffect(() => { cb.current = onBackOnline; });
  useEffect(() => {
    const on = () => { setOnline(true); cb.current?.(); }, off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  return online;
}