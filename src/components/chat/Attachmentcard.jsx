import { X } from 'lucide-react';
import { clickable } from '../../lib/Styles';
import { cn } from '../../lib/Utils';

// Thumbnail of an attached image / video / file. size: 'sm' (composer) or 'lg' (inside a message).
// Pass onRemove to show the small X button.
export default function AttachmentCard({ att, size = 'sm', onRemove }) {
  return (
    <div
      title={att.name}
      className={cn(
        'relative grid flex-none place-items-center overflow-hidden rounded-[10px] border border-line bg-panel',
        size === 'lg' ? 'size-28' : 'size-16',
      )}
    >
      {att.thumb
        ? <img src={'data:image/jpeg;base64,' + att.thumb} alt={att.name} className="size-full object-cover" />
        : <span className="overflow-hidden p-1 text-[10px] break-all text-mute">{att.name}</span>}
      {att.kind === 'video' && (
        <span className="absolute bottom-[3px] left-[3px] rounded-[4px] bg-black/65 px-[5px] text-[10px] text-white">video</span>
      )}
      {onRemove && (
        <button
          aria-label="Remove attachment"
          onClick={onRemove}
          className={cn(clickable, 'absolute top-[3px] right-[3px] inline-flex size-[22px] items-center justify-center rounded-full bg-black/65 p-0 text-white')}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}