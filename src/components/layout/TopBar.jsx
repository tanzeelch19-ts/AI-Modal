import { Menu, Moon, Sun } from 'lucide-react';
import iconButton from '../ui/iconButton';

export default function TopBar({ title, theme, onMenu, onToggleTheme }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-line px-3.5">
      {/* hamburger: only on phones */}
      <IconButton aria-label="Menu" onClick={onMenu} className="min-[721px]:hidden"><Menu size={18} /></IconButton>
      <strong className="min-w-0 flex-1 truncate">{title}</strong>
      <IconButton aria-label="Toggle theme" onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
    </div>
  );
}