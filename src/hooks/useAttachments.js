import { useState } from 'react';
import { MAX_IMG } from "../lib/Constants";

import {readImage,  readVideo } from '../lib/Media';

// Files waiting to be sent with the next message (images, video frames, text files).

export function useAttachments(toast) {
  const [pending, setPending] = useState([]);
 
  async function addFiles(files) {
    let used = pending.reduce((a, p) => a + (p.images?.length || 0), 0);
    for (const f of files) {
      try {
        const isVid = f.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
        if (f.type.startsWith('image/')) {
          if (used >= MAX_IMG) { toast(`You can attach up to ${MAX_IMG} images per message.`); continue; }
          const r = await readImage(f);
          used += r.images.length;
          setPending((p) => [...p, { name: f.name || 'pasted-image', kind: 'image', ...r }]);
        } else if (isVid) {
          if (used >= MAX_IMG) { toast(`You can attach up to ${MAX_IMG} images per message.`); continue; }
          toast('Reading video frames…');
          const r = await readVideo(f, Math.min(6, MAX_IMG - used));
          used += r.images.length;
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
 