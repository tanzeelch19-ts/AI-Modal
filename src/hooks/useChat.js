import { useRef, useState } from 'react';
import { useLocalStorage } from '../lib/Uselocalstorage';
import { streamChat } from '../lib/Api';
import { toApi } from '../lib/buildUserMessage';
import { uid } from '../lib/utils';


// Everything about conversations: list, current chat, sending, streaming, regenerate, delete, usage.
export function useChat() {
  const [chats, setChats] = useLocalStorage('devai:chats', []);
  const [cur, setCur] = useLocalStorage('devai:cur', null);
  const [usage, setUsage] = useLocalStorage('devai:usage', { n: 0, in: 0, out: 0 });
  const [busy, setBusy] = useState(false);
  const blobs = useRef({});      // message id -> base64 images (memory only)
  const abortRef = useRef(null);
 
  const chat = chats.find((c) => c.id === cur);
  const patch = (id, fn) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
 
  async function run(chatId, history) {
    const aid = uid(), ctrl = new AbortController();
    abortRef.current = ctrl; setBusy(true);
    patch(chatId, (c) => ({ ...c, msgs: [...history, { id: aid, role: 'assistant', text: '' }] }));
    let acc = '', timer = 0;
    const setText = (text, err) => patch(chatId, (c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === aid ? { ...m, text, err } : m)) }));
    const flush = () => { timer = 0; setText(acc); };   // update the screen at most every 60 ms
    try {
      await streamChat({
        messages: toApi(history, blobs.current),
        signal: ctrl.signal,
        onText: (t) => { acc += t; if (!timer) timer = setTimeout(flush, 60); },
        onUsage: (u) => setUsage((x) => ({ n: x.n + 1, in: x.in + (u.input_tokens || 0), out: x.out + (u.output_tokens || 0) })),
      });
      clearTimeout(timer); setText(acc || '(no reply)');
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') setText(acc || '(stopped)');
      else if (acc) setText(acc);
      else setText(e instanceof TypeError ? 'Cannot reach the server. Check your connection, then press Retry.' : e.message || 'Something went wrong.', true);
    } finally { setBusy(false); abortRef.current = null; }
  }
 
  function send(message, images) {
    if (images?.length) blobs.current[message.id] = images;
    let id = cur;
    if (!chat) { id = uid(); setChats((cs) => [{ id, title: message.text.slice(0, 32), msgs: [] }, ...cs]); setCur(id); }
    else if (!chat.msgs.length) patch(id, (c) => ({ ...c, title: message.text.slice(0, 32) }));
    run(id, [...(chat?.msgs || []), message]);
  }
 
  function regenerate() {
    if (busy || !chat) return;
    const msgs = [...chat.msgs];
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    if (msgs.length) run(chat.id, msgs);
  }
 
  function deleteChat(id) {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (cur === id) setCur(null);
  }
 
  return {
    chats, chat, cur, usage, busy,
    send, regenerate, deleteChat,
    stop: () => abortRef.current?.abort(),
    selectChat: setCur,
    startNewChat: () => setCur(null),
  };
}
 