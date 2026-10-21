import { Menu, Moon, Sun } from 'lucide-react';
import IconButton from '../ui/IconButtons.jsx';

export default function TopBar({ title, theme, onMenu, onToggleTheme }) {
  return (
    <div className="flex h-14 flex-none items-center gap-2 border-b border-line px-3.5 short:h-11">
      {/* hamburger: only where the sidebar is a slide-in drawer (phones, upright tablets) */}
      <IconButton aria-label="Menu" onClick={onMenu} className="min-[901px]:hidden"><Menu size={18} /></IconButton>
      <strong className="min-w-0 flex-1 truncate">{title}</strong>
      <IconButton aria-label="Toggle theme" onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>
    </div>
  );
}