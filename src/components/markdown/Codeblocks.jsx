import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {  clickable, scrollbar  } from '../../lib/Styles';
import { cn,copyText } from '../../lib/Utils';

// Replaces <pre> in markdown: language label + Copy button above the code.
export default function CodeBlock({ children }) {
  const [ok, setOk] = useState(false);
  const lang = /language-(\S+)/.exec(children?.props?.className || '')?.[1] || 'code';
  const txt = String(children?.props?.children ?? '').replace(/\n$/, '');

  async function onCopy() {
    if (await copyText(txt)) {
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    }
  }

  return (
    <div className="my-2.5 overflow-hidden rounded-[10px] border border-line bg-side">
      <div className="flex items-center justify-between border-b border-line py-1 pr-1.5 pl-3 font-mono text-[12px] leading-normal text-mute">
        <span>{lang}</span>
        <button onClick={onCopy} className={cn(clickable, 'inline-flex items-center gap-1.5 rounded-lg px-2 py-[3px] text-[.78rem] text-mute pointer-coarse:min-h-10')}>
          {ok ? <Check size={13} /> : <Copy size={13} />}
          {ok ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={cn('m-0 overflow-x-auto p-2.5 font-mono text-[13px] leading-[1.5]', scrollbar)}>{children}</pre>
    </div>
  );
}