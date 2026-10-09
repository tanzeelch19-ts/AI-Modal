import { MAX_IMG } from "./Constants";
import { uid } from './Utils.js';

// Build the message object saved in the chat from the typed text + pending attachments.
// Returns { message, images } - `images` (base64 frames) are kept in memory only.
export function buildUserMessage(text, pending) {
  const media = pending.filter((p) => p.images);
  const message = {
    id: uid(),
    role: 'user',
    text: text || (media.some((p) => p.kind === 'video')
      ? 'Describe what happens in this video and point out anything notable.'
      : media.length ? 'Describe this image and point out anything notable.' : 'Please review the attached file.'),
    att: pending.map(({ name, kind, thumb, frames, dur }) => ({ name, kind, thumb, frames, dur })),
    extra: pending.filter((p) => p.kind === 'text').map((p) => `File "${p.name}":\n\`\`\`\n${p.text}\n\`\`\``).join('\n\n') || undefined,
  };
  return { message, images: media.flatMap((p) => p.images) };
}

// Convert stored messages to the API format. Images live only in memory (blobs), newest first, capped.
export function toApi(msgs, blobs) {
  const keep = new Set(); let n = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const b = blobs[msgs[i].id];
    if (b?.length && n + b.length <= MAX_IMG) { keep.add(msgs[i].id); n += b.length; }
  }
  const out = [];
  for (const m of msgs) {
    if (m.err || (!m.text && !m.extra)) continue;
    if (m.role === 'assistant') { out.push({ role: 'assistant', content: m.text }); continue; }
    const media = (m.att || []).filter((a) => a.kind !== 'text');
    const parts = keep.has(m.id) ? blobs[m.id].map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })) : [];
    let txt = m.text + (m.extra ? '\n\n' + m.extra : '');
    if (keep.has(m.id)) txt += '\n\n[Attached: ' + media.map((a) => a.kind === 'video' ? `${a.frames} frames sampled evenly in time order from the video "${a.name}" (${Math.round(a.dur)}s)` : `the image "${a.name}"`).join('; ') + '. The pictures are shown above, in that order.]';
    else if (media.length) txt = '[Earlier image/video attachment is no longer available]\n' + txt;
    out.push({ role: 'user', content: [...parts, { type: 'text', text: txt }] });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.slice(-30);
}