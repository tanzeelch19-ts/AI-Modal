import { useState } from 'react';
import { MAX_IMG, IMG_CAP, FRAME_CAP, MEDIA_BUDGET, readImage, readVideo } from '../lib/pictures.js';

const MIN_ROOM = 60_000;   // less than this per picture would be too blurry to read
const TOO_BIG = 'These attachments are too big to send together. Remove one, or send fewer pictures.';
const chars = (list) => list.reduce((a, p) => a + (p.images || []).reduce((b, s) => b + s.length, 0), 0);

// Files waiting to be sent with the next message (images, video frames, text files).
export function useAttachments(toast) {
  const [pending, setPending] = useState([]);

  async function addFiles(files) {
    let used = pending.reduce((a, p) => a + (p.images?.length || 0), 0);
    let size = chars(pending);
    for (const f of files) {
      try {
        const isVid = f.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
        if (f.type.startsWith('image/')) {
          if (used >= MAX_IMG) { toast(`You can attach up to ${MAX_IMG} images per message.`); continue; }
          const room = MEDIA_BUDGET - size;
          if (room < MIN_ROOM) { toast(TOO_BIG); continue; }
          const r = await readImage(f, Math.min(IMG_CAP, room));
          if (chars([r]) > room) { toast(TOO_BIG); continue; }
          used += 1; size += chars([r]);
          setPending((p) => [...p, { name: f.name || 'pasted-image', kind: 'image', ...r }]);
        } else if (isVid) {
          const slots = MAX_IMG - used;
          if (slots <= 0) { toast(`You can attach up to ${MAX_IMG} images per message.`); continue; }
          const cap = Math.min(FRAME_CAP, Math.floor((MEDIA_BUDGET - size) / slots));
          if (cap < MIN_ROOM) { toast(TOO_BIG); continue; }
          toast('Reading video frames…');
          const r = await readVideo(f, { max: slots, cap });
          used += r.images.length; size += chars([r]);
          setPending((p) => [...p, { name: f.name, kind: 'video', frames: r.images.length, ...r }]);
        } else {
          if (f.size > 300000) { toast(f.name + ' is over 300 KB and was skipped.'); continue; }
          const text = await f.text();
          if (text.includes('\u0000')) { toast(f.name + ' is not a text, image or video file.'); continue; }
          setPending((p) => [...p, { name: f.name, kind: 'text', text }]);
        }
      } catch (e) { toast(e.message || 'Could not read ' + f.name); }
    }
  }

  const removeAt = (i) => setPending((p) => p.filter((_, j) => j !== i));
  const clear = () => setPending([]);

  return { pending, addFiles, removeAt, clear };
}