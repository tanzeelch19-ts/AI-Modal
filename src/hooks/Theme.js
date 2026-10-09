import { useEffect } from 'react';
import { LocalStorage } from '../lib/LocalStorage';

export function Theme() {
  const [theme, setTheme] = LocalStorage('devai:theme', matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggleTheme];
}