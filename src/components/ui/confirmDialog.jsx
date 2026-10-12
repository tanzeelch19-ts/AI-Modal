import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clickable } from '../../lib/Styles.js';
import { cn } from '../../lib/Utils.js';

const button = 'rounded-[10px] border px-4 py-2 transition-colors active:scale-[.96] pointer-coarse:min-h-10';

// An "Are you sure?" window drawn inside the app (not the browser's own confirm box).
// Esc or a click outside = cancel. It is drawn on <body> so it covers the whole screen, also on phones.
export default function confirmDialog({ open, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel }) {
  const id = useId();
  const cancelBtn = useRef(null);
  const confirmBtn = useRef(null);
  const cancel = useRef(onCancel);
  useEffect(() => { cancel.current = onCancel; });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;   // focus goes back there when the window closes
    cancelBtn.current?.focus();              // the safe button is focused first
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel.current(); return; }
      if (e.key !== 'Tab') return;
      // keep Tab inside the window
      const [first, last] = [cancelBtn.current, confirmBtn.current];
      const at = document.activeElement;
      if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      else if (at !== first && at !== last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 font-sans text-[15px] leading-[1.55] text-ink transition-opacity duration-150 starting:opacity-0"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id + 't'}
        aria-describedby={id + 'd'}
        className="w-full max-w-[380px] rounded-2xl border border-line bg-side p-5 shadow-[0_20px_60px_rgba(0,0,0,.45)] transition duration-150 starting:scale-95 starting:opacity-0"
      >
        <h2 id={id + 't'} className="text-[1.05rem] font-bold">{title}</h2>
        <p id={id + 'd'} className="mt-1.5 text-[.92rem] text-mute wrap-anywhere">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelBtn} onClick={onCancel} className={cn(clickable, button, 'border-line font-medium hover:bg-panel')}>
            {cancelText}
          </button>
          <button ref={confirmBtn} onClick={onConfirm} className={cn(clickable, button, 'border-err/50 bg-err/10 font-semibold text-err hover:bg-err/20')}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}