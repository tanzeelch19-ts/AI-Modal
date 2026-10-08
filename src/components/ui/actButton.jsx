import { cn } from "../../lib/Utils";
import { clickable } from '../../lib/Styles';

// Small text button under a reply (Copy, Save, Listen...). On very small screens only the icon is shown.
export default function actButton({ className, ...props }) {
  return (
    <button
      className={cn(
        clickable,
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-[3px] text-[.8rem] text-mute transition-colors',
        'hover:bg-panel hover:text-ink active:scale-[.96] pointer-coarse:min-h-9',
        'tiny:gap-0 tiny:text-[0px] tiny:[&_svg]:size-[18px]',
        className,
      )}
      {...props}
    />
  );
}