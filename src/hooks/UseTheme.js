import { useEffect } from 'react';
import { useLocalStorage } from '../lib/useLocalStorage';

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('devai:theme', matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggleTheme];
}