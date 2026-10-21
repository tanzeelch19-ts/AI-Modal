import { useRef, useState } from 'react';
import Composer from './components/chat/Composer.jsx';
import EmptyState from './components/chat/EmptyState.jsx';
import MessageList from './components/chat/MessageList.jsx';
import OfflineBanner from './components/layout/OfflineBanner.jsx';
import SavedView from './components/views/SavedView.jsx';
import Sidebar from './components/layout/sideBar.jsx';
import ScrollToBottom from './components/ui/ScrollBottoms.jsx';
import Toast from './components/ui/Toast.jsx';
import TopBar from './components/layout/TopBar.jsx';
import UsageView from './components/views/UsageView.jsx';
import { useAttachments } from './hooks/useAttachments.js';
import { AutoScroll } from './hooks/AutoScroll.js';
import { useChat } from './hooks/useChat.js';
import { useLocalStorage } from './hooks/LocalStorage.js';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';
import { useTheme } from './hooks/Theme.js';
import { useToast } from './hooks/useToast.js';
import { useVoiceInput } from './hooks/VoiceInput.js';
import { buildUserMessage } from './lib/buildUserMessage.js';
import { scrollbar } from './lib/Styles.js';
import { cn, copyText, speak } from './lib/Utils.js';

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

  const { away, toBottom, stickNext } = AutoScroll(listRef, [chat?.msgs, view]);

  const msgs = chat?.msgs || [];

  function onSend() {
    const text = input.trim();
    if (busy || (!text && !pending.length)) return;
    const { message, images } = buildUserMessage(text, pending);
    stickNext();   // your own message always scrolls into view, even if you had scrolled up
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
    <div className="flex h-dvh bg-app pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-[15px] leading-[1.55] text-ink">
      <Sidebar
        open={menu}
        view={view}
        chats={chats}
        cur={cur}
        onClose={() => setMenu(false)}
        onNewChat={() => { stickNext(); startNewChat(); setView('chat'); setMenu(false); }}
        onOpenView={(v) => { stickNext(); setView(v); setMenu(false); }}
        onOpenChat={(id) => { stickNext(); selectChat(id); setView('chat'); setMenu(false); }}
        onDeleteChat={deleteChat}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <TopBar title={title} theme={theme} onMenu={() => setMenu(true)} onToggleTheme={toggleTheme} />
        {!online && <OfflineBanner />}

        <div className="relative flex min-h-0 flex-1 flex-col">
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
          <ScrollToBottom show={away} onClick={toBottom} />
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