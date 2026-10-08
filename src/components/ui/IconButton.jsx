import { cn } from "../../lib/Utils";
import { brandGradient, clickable } from '../../lib/Styles';

const base = clickable + ' inline-flex size-[38px] flex-none items-center justify-center rounded-[10px] p-0 transition-colors active:scale-[.96] pointer-coarse:size-11';

const variants = {
  ghost: 'text-mute hover:bg-panel hover:text-ink',
  live: 'bg-panel text-err',            // e.g. microphone while listening
  send: brandGradient + ' font-semibold text-gfg',
};

export default function ({ variant = 'ghost', className, ...props }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}