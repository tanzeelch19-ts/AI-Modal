import { useRef } from 'react';
import { Mic, Paperclip, Send, Square } from 'lucide-react';
import attachCard from './attachCard.jsx';
import icoButton from '../ui/icoButton.jsx';
import { scrollbar } from '../../lib/Styles.js';
import { cn } from '../../lib/Utils.js';

export default function Composer({
  input, setInput, textareaRef,
  pending, onRemovePending, onAddFiles,
  busy, onSend, onStop,
  listening, onMic,
}) {
  const fileRef = useRef(null);

  return (
    <div
      className="px-4 pb-[calc(14px+env(safe-area-inset-bottom))]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onAddFiles([...e.dataTransfer.files]); }}
    >
      {pending.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-[760px] flex-wrap gap-2">
          {pending.map((p, i) => <AttachmentCard key={i} att={p} onRemove={() => onRemovePending(i)} />)}
        </div>
      )}

      <div className="mx-auto flex max-w-[760px] items-end gap-1.5 rounded-[18px] border border-line bg-side p-2 shadow-[0_10px_32px_rgba(0,0,0,.2)] focus-within:border-acc">
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onAddFiles([...e.target.files]); e.target.value = ''; }} />
        <IconButton aria-label="Attach images, videos or files" onClick={() => fileRef.current.click()}><Paperclip size={18} /></IconButton>

        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          aria-label="Message"
          placeholder="Ask anything, attach an image or video, or paste code…"
          className={cn('max-h-40 flex-1 resize-none bg-transparent px-1.5 py-2 outline-none mobile:text-base', scrollbar)}
          onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          onPaste={(e) => {
            const fs = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
            if (fs.length) { e.preventDefault(); onAddFiles(fs); }
          }}
        />

        <IconButton aria-label="Voice input" variant={listening ? 'live' : 'ghost'} onClick={onMic}><Mic size={18} /></IconButton>
        {busy
          ? <IconButton variant="send" aria-label="Stop" onClick={onStop}><Square size={16} /></IconButton>
          : <IconButton variant="send" aria-label="Send" onClick={onSend}><Send size={18} /></IconButton>}
      </div>
    </div>
  );
}