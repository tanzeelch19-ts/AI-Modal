import { ArrowDown } from 'lucide-react';
import { clickable } from '../../lib/Styles.js';
import { cn } from '../../lib/Utils.js';

// Round button on the right side of the chat. It appears when you have scrolled up
// and takes you back down to the newest message.
export default function ScrollToBottom({ show, onClick }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 px-4 mobile:px-3">
      <div className="mx-auto flex max-w-[760px] justify-end">
        <button
          type="button"
          aria-label="Scroll to the latest message"
          title="Scroll to the latest message"
          aria-hidden={!show}
          tabIndex={show ? 0 : -1}
          onClick={onClick}
          className={cn(
            clickable,
            'inline-flex size-10 items-center justify-center rounded-full border border-line bg-side p-0 text-ink shadow-[0_6px_20px_rgba(0,0,0,.25)]',
            'transition duration-150 hover:bg-panel active:scale-[.92] pointer-coarse:size-11 motion-reduce:transition-none',
            show ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <ArrowDown size={18} />
        </button>
      </div>
    </div>
  );
}