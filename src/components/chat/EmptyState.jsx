import { PROMPTS } from '../../lib/Const';
import { clickable } from '../../lib/Styles';
import { cn } from '../../lib/Utils';
export default function EmptyState({ onPick }) {
  return (
    <div className="mt-[10vh] text-center">
      <h2 className="text-[2rem] font-bold mobile:text-[1.6rem]">How can I help?</h2>
      <div className="mx-auto mt-7 grid max-w-[620px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 text-left mobile:grid-cols-1">
        {PROMPTS.map(([Icon, title, desc, prompt]) => (
          <button
            key={title}
            onClick={() => onPick(prompt)}
            className={cn(clickable, 'inline-flex flex-col items-start gap-1 rounded-[14px] border border-line bg-side p-4 transition-colors hover:border-acc hover:bg-panel active:scale-[.96] pointer-coarse:min-h-10')}
          >
            <Icon size={20} className="mb-1.5 text-acc" />
            <b>{title}</b>
            <span className="text-[.88rem] text-mute">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}