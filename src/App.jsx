import { useRef, useState } from 'react';
import Composer from './components/chat/Composer';
import EmptyState from './components/chat/EmptyState';
import MessageList from './components/chat/MessageList';
import OfflineBanner from './components/layout/OfflineBanner';
import SavedView from './components/views/SavedView';
import Sidebar from './components/layout/SideBar';
import Toast from './components/ui/Toast';
import TopBar from './components/layout/TopBar';
import UsageView from './components/views/UsageView';
import { useAttachments } from './hooks/useAttachments';
import { AutoScroll } from './lib/AutoScroll';
import { useChat } from './hooks/useChat';
import { LocalStorage } from './lib/LocalStorage';
import { useOnlineStatus } from './lib/useOnlineStatus'
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { voiceInput } from './hooks/VoiceInput';
import { buildUserMessage } from './lib/buildUserMessage';
import { scrollbar } from './lib/Styles';
import { cn , copyText, speak } from './lib/Utils';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [saved, setSaved] = useLocalStorage('devai:saved', []);
  const [view, setView] = useState('chat'); // 'chat' | 'saved' | 'usage'
  const [menu, setMenu] = useState(false);  // sidebar open on phones
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const listRef = useRef(null);

  const { note, toast } = useToast();
  const online = useOnlineStatus(() => toast('Back online.'));
  const { chats, chat, cur, usage, busy, send, regenerate, deleteChat, stop, selectChat, startNewChat } = useChat();
  const { pending, addFiles, removeAt, clear } = useAttachments(toast);
  const { listening, toggleMic } = useVoiceInput({ input, setInput, toast });

  useAutoScroll(listRef, [chat?.msgs, view]);

  const msgs = chat?.msgs || [];

  function onSend() {
    const text = input.trim();
    if (busy || (!text && !pending.length)) return;
    const { message, images } = buildUserMessage(text, pending);
    send(message, images);
    setView('chat');
    setInput('');
    clear();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  const onCopy = (text) => copyText(text).then((ok) => toast(ok ? 'Copied' : 'Copy failed'));
  const onSave = (text) => { setSaved([text, ...saved]); toast('Saved'); };
  const onPickPrompt = (prompt) => { setInput(prompt); textareaRef.current?.focus(); };

  const title = view === 'saved' ? 'Saved responses' : view === 'usage' ? 'Usage' : chat?.title || 'DevAI';

  return (
    <div className="flex h-dvh bg-app pt-[env(safe-area-inset-top)] font-sans text-[15px] leading-[1.55] text-ink">
      <Sidebar
        open={menu}
        view={view}
        chats={chats}
        cur={cur}
        onClose={() => setMenu(false)}
        onNewChat={() => { startNewChat(); setView('chat'); setMenu(false); }}
        onOpenView={(v) => { setView(v); setMenu(false); }}
        onOpenChat={(id) => { selectChat(id); setView('chat'); setMenu(false); }}
        onDeleteChat={deleteChat}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar title={title} theme={theme} onMenu={() => setMenu(true)} onToggleTheme={toggleTheme} />
        {!online && <OfflineBanner />}

        <div ref={listRef} className={cn('flex-1 overflow-y-auto px-4 py-5 mobile:px-3 mobile:py-3.5', scrollbar)}>
          {view === 'saved' && (
            <SavedView saved={saved} onCopy={onCopy} onRemove={(i) => setSaved(saved.filter((_, j) => j !== i))} />
          )}
          {view === 'usage' && <UsageView usage={usage} chatCount={chats.length} />}
          {view === 'chat' && !msgs.length && <EmptyState onPick={onPickPrompt} />}
          {view === 'chat' && msgs.length > 0 && (
            <MessageList
              msgs={msgs}
              busy={busy}
              onCopy={onCopy}
              onSave={onSave}
              onSpeak={(text) => speak(text, toast)}
              onRegenerate={regenerate}
            />
          )}
        </div>

        {view === 'chat' && (
          <Composer
            input={input}
            setInput={setInput}
            textareaRef={textareaRef}
            pending={pending}
            onRemovePending={removeAt}
            onAddFiles={addFiles}
            busy={busy}
            onSend={onSend}
            onStop={stop}
            listening={listening}
            onMic={toggleMic}
          />
        )}
        <Toast note={note} />
      </main>
    </div>
  );
}