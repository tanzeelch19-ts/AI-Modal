import { Bookmark, Copy, RefreshCw, Sparkles, Volume2 } from 'lucide-react';
import ActionButton from '../ui/Actionbutton.jsx';
import Markdown from '../markdown/Markdown.jsx';
import Thumbs from './Thumbs.jsx';
import { brandGradient } from '../../lib/Styles.js';
import { cn } from '../../lib/Utils.js';

const DOT_DELAYS = ['', '[animation-delay:.15s]', '[animation-delay:.3s]'];

// "Typing" dots shown while waiting for the first part of a reply.
function Dots() {
  return (
    <span>
      {DOT_DELAYS.map((d, i) => (
        <span key={i} className={cn('mr-1 inline-block size-[7px] animate-dot rounded-full bg-acc motion-reduce:animate-none', d)} />
      ))}
    </span>
  );
}

export default function Message({ m, isLast, busy, onCopy, onSave, onSpeak, onRegenerate }) {
  const ai = m.role === 'assistant';

  return (
    <div className={cn('mb-[22px] flex gap-2.5', !ai && 'flex-row-reverse')}>
      {ai && (
        <div className={cn('grid size-[30px] flex-none place-items-center rounded-[9px] text-gfg', brandGradient)}><Sparkles size={15} /></div>
      )}

      <div
        className={cn(
          'min-w-0 wrap-anywhere',
          ai ? 'flex-1' : 'max-w-[85%] flex-none rounded-[16px_16px_4px_16px] bg-panel px-3.5 py-2.5 mobile:max-w-[92%]',
        )}
      >
        <Thumbs att={m.att} />

        {!ai ? <span className="whitespace-pre-wrap">{m.text}</span>
          : m.err ? <span className="text-err">{m.text}</span>
          : m.text ? <Markdown>{m.text}</Markdown>
          : <Dots />}

        {!ai && m.att?.filter((a) => a.kind === 'text').map((a, k) => (
          <div key={k} className="mt-1.5 inline-block rounded-md border border-line px-2 text-[.8rem] text-mute">{a.name}</div>
        ))}

        {ai && !busy && m.text && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!m.err && (
              <>
                <ActionButton onClick={() => onCopy(m.text)}><Copy size={14} />Copy</ActionButton>
                <ActionButton onClick={() => onSave(m.text)}><Bookmark size={14} />Save</ActionButton>
                <ActionButton onClick={() => onSpeak(m.text)}><Volume2 size={14} />Listen</ActionButton>
              </>
            )}
            {isLast && <ActionButton onClick={onRegenerate}><RefreshCw size={14} />{m.err ? 'Retry' : 'Regenerate'}</ActionButton>}
          </div>
        )}
      </div>
    </div>
  );
}