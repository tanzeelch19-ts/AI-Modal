import { useRef, useState } from 'react';
import { fetchAiTitle, quickTitle, uniqueTitle } from '../lib/chatTitles';
import {INDEX_KEY, loadChat, loadIndex, loadUsage, removeChat, removeEntry, saveChat, saveUsage, upsertEntry } from '../lib/Chatstore.js';
import { streamChat } from '../lib/Api';
import { toApi } from '../lib/buildUserMessage';
import { uid } from '../lib/Utils';


// Everything about conversations: history list, open chat, sending, streaming, regenerate, delete, usage.
//
// How history works (like ChatGPT):
//  - Every chat is saved on its own under its own unique name (see chatStore.js / chatTitle.js).
//  - When the page is opened or reloaded, a NEW empty chat is shown; all old chats stay in the sidebar.
//  - While a reply is streaming nothing is written to storage (fast). It is saved when the reply ends,
//    and also when the tab is hidden or closed.
export function useChat() {
  const [chats, setChats] = useState(loadIndex);   // sidebar list: [{ id, title, ts }]
  const [cur, setCur] = useState(null);            // open chat id; null = new empty chat
  const [msgs, setMsgs] = useState([]);            // messages of the open chat
  const [usage, setUsage] = useState(loadUsage);
  const [live, setLive] = useState([]);            // ids of chats that are answering right now
 
  const curRef = useRef(null);          // same as `cur`, readable inside async code
  const work = useRef(new Map());       // id -> messages in memory (open chat, answering chats, unsaved changes)
  const dirty = useRef(new Set());      // ids with changes not yet written to storage
  const ctrls = useRef(new Map());      // id -> AbortController of the running reply
  const gone = useRef(new Set());       // deleted ids (late updates for them are ignored)
  const blobs = useRef({});             // message id -> base64 images (memory only)
 
  // Change the messages of chat `id`. The screen updates only if that chat is the open one.
  function update(id, next) {
    if (gone.current.has(id)) return;
    const value = typeof next === 'function' ? next(work.current.get(id) || []) : next;
    work.current.set(id, value);
    dirty.current.add(id);
    if (curRef.current === id) setMsgs(value);
  }
 
  // Write one chat (and its place in the sidebar list) to storage.
  function save(id, patch) {
    if (gone.current.has(id) || !dirty.current.has(id)) return;
    const ms = work.current.get(id);
    dirty.current.delete(id);
    if (!ms?.length) return;
    saveChat(id, ms);
    setChats(upsertEntry(id, { ts: Date.now(), ...patch }));
    if (curRef.current !== id && !ctrls.current.has(id)) work.current.delete(id);   // free memory
  }
 
  function show(id) {
    curRef.current = id;
    setCur(id);
    setMsgs(id ? work.current.get(id) || [] : []);
  }
 
  // Forget the chat we are leaving, unless it is still answering or has unsaved changes.
  function leave() {
    const id = curRef.current;
    if (id && !dirty.current.has(id) && !ctrls.current.has(id)) work.current.delete(id);
  }
 
  // After the first reply: ask the AI for a nicer name and replace the quick one.
  async function giveName(id, history, reply) {
    if (gone.current.has(id) || history.filter((m) => m.role === 'user').length !== 1) return;
    if (loadIndex().find((e) => e.id === id)?.ai) return;
    const t = await fetchAiTitle(history[0].text, reply);
    if (!t || gone.current.has(id)) return;
    const list = loadIndex();
    if (!list.some((e) => e.id === id)) return;   // deleted meanwhile (maybe in another tab)
    setChats(upsertEntry(id, { title: uniqueTitle(t, list, id), ai: 1 }));
  }
 
  async function run(id, history) {
    const aid = uid(), ctrl = new AbortController();
    ctrls.current.set(id, ctrl);
    setLive((l) => [...l, id]);
    update(id, [...history, { id: aid, role: 'assistant', text: '' }]);
 
    let acc = '', timer = 0, failed = false;
    const setText = (text, err) => update(id, (ms) => ms.map((m) => (m.id === aid ? { ...m, text, err } : m)));
    const tick = () => { timer = 0; setText(acc); };   // update the screen at most every 60 ms
 
    try {
      await streamChat({
        messages: toApi(history, blobs.current),
        signal: ctrl.signal,
        onText: (t) => { acc += t; if (!timer) timer = setTimeout(tick, 60); },
        onUsage: (u) => setUsage((x) => ({ n: x.n + 1, in: x.in + (u.input_tokens || 0), out: x.out + (u.output_tokens || 0) })),
      });
      clearTimeout(timer); setText(acc || '(no reply)');
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') setText(acc || '(stopped)');
      else if (acc) setText(acc);
      else { failed = true; setText(e instanceof TypeError ? 'Cannot reach the server. Check your connection, then press Retry.' : e.message || 'Something went wrong.', true); }
    } finally {
      ctrls.current.delete(id);
      setLive((l) => l.filter((x) => x !== id));
      save(id);
    }
    if (acc && !failed) giveName(id, history, acc);
  }
 
  function send(message, images) {
    if (images?.length) blobs.current[message.id] = images;
    let id = curRef.current, patch;
    if (!id) {
      id = uid();
      patch = { title: uniqueTitle(quickTitle(message.text, message.att), loadIndex(), id) };
      work.current.set(id, []);
      show(id);
    } else if (!(work.current.get(id) || []).length) {
      patch = { title: uniqueTitle(quickTitle(message.text, message.att), loadIndex(), id) };
    }
    const history = [...(work.current.get(id) || []), message];
    update(id, history);
    save(id, patch);   // the question is saved at once, so a reload right now keeps it
    run(id, history);
  }
 
  function regenerate() {
    const id = curRef.current;
    if (!id || ctrls.current.has(id)) return;
    const ms = [...(work.current.get(id) || [])];
    while (ms.length && ms[ms.length - 1].role === 'assistant') ms.pop();
    if (ms.length) run(id, ms);
  }
 
  function selectChat(id) {
    if (!id) return startNewChat();
    if (id === curRef.current) return;
    leave();
    // An answering chat or one with unsaved changes is already up to date in memory; otherwise read it fresh.
    if (!(work.current.has(id) && (ctrls.current.has(id) || dirty.current.has(id)))) work.current.set(id, loadChat(id));
    show(id);
  }
 
  function startNewChat() {
    leave();
    show(null);
  }
 
  function deleteChat(id) {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    ctrls.current.get(id)?.abort();
    gone.current.add(id);
    work.current.delete(id);
    dirty.current.delete(id);
    removeChat(id);
    setChats(removeEntry(id));
    if (curRef.current === id) show(null);
  }
 
  useEffect(() => {
    const flush = () => { for (const id of [...dirty.current]) save(id); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    // Another tab changed the history: refresh the sidebar.
    const onStorage = (e) => { if (e.key === null || e.key === INDEX_KEY) setChats(loadIndex()); };
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    addEventListener('storage', onStorage);
    return () => {
      removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      removeEventListener('storage', onStorage);
      flush();
    };
  }, []);
 
  useEffect(() => { saveUsage(usage); }, [usage]);
 
  const chat = cur ? { id: cur, title: chats.find((c) => c.id === cur)?.title || 'New chat', msgs } : null;
 
  return {
    chats, chat, cur, usage,
    busy: live.includes(cur),
    send, regenerate, deleteChat, selectChat, startNewChat,
    stop: () => ctrls.current.get(curRef.current)?.abort(),
  };
}
 