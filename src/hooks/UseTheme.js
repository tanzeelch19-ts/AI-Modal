import { useEffect } from 'react';
import { UseLocalStorage } from '../lib/UseLocalStorage';

export function useTheme() {
  const [theme, setTheme] = useLocalStorage('devai:theme', matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return [theme, toggleTheme];
}