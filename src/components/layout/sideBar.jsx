import { BarChart3, Bookmark, Plus, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '../../lib/Utils';
import {brandGradient, clickable,  scrollbar } from '../../lib/Styles'; 


const row = clickable + ' inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors active:scale-[.96] pointer-coarse:min-h-10';
const on = 'bg-panel text-ink';
const off = 'text-mute hover:bg-panel hover:text-ink';

function NavButton({ active, icon: Icon, children, ...props }) {
  return (
    <button className={cn(row, active ? on : off)} {...props}>
      <Icon size={18} />
      {children}
    </button>
  );
}

export default function sideBar({ open, view, chats, cur, onClose, onNewChat, onOpenView, onOpenChat, onDeleteChat }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/50 min-[721px]:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'flex w-[270px] flex-col gap-2 overflow-y-auto border-r border-line bg-side p-3',
          scrollbar,
          'mobile:fixed mobile:inset-y-0 mobile:left-0 mobile:z-30 mobile:w-[82%] mobile:max-w-[310px]',
          'mobile:pt-[calc(12px+env(safe-area-inset-top))] mobile:transition-transform mobile:duration-200',
          open ? 'mobile:translate-x-0' : 'mobile:-translate-x-full',
        )}
      >
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className={cn('grid size-[34px] place-items-center rounded-[10px] text-gfg', brandGradient)}><Sparkles size={18} /></span>
          <h1 className="text-[1.25rem] font-bold">DevAI</h1>
        </div>

        <button
          onClick={onNewChat}
          className={cn(clickable, brandGradient, 'inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] p-2.5 font-semibold text-gfg active:scale-[.96] pointer-coarse:min-h-10')}
        >
          <Plus size={18} />New chat
        </button>

        <nav className="flex flex-col gap-0.5">
          <NavButton icon={Bookmark} active={view === 'saved'} onClick={() => onOpenView('saved')}>Saved</NavButton>
          <NavButton icon={BarChart3} active={view === 'usage'} onClick={() => onOpenView('usage')}>Usage</NavButton>
        </nav>

        <div className="mx-1 mt-2.5 mb-0.5 text-[.8rem] text-mute">Recent chats</div>
        <div>
          {chats.map((c) => {
            const active = c.id === cur && view === 'chat';
            return (
              <div key={c.id} className="flex items-center">
                <button
                  onClick={() => onOpenChat(c.id)}
                  className={cn(clickable, 'block min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left transition-colors pointer-coarse:min-h-10', active ? on : off)}
                >
                  {c.title || 'New chat'}
                </button>
                <button
                  aria-label="Delete chat"
                  onClick={() => onDeleteChat(c.id)}
                  className={cn(clickable, 'inline-flex size-9 flex-none items-center justify-center rounded-lg p-0 text-mute transition-colors hover:bg-panel hover:text-err pointer-coarse:size-11')}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}