import { MAX_IMG, MEDIA_BUDGET } from './pictures.js';

const uid = () => crypto.randomUUID();

// 75 -> "1:15"
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const imageCount = (a) => (a.kind === 'video' ? a.frames || 0 : 1);

// Build the message object saved in the chat from the typed text + pending attachments.
// Returns { message, images } - `images` (base64 frames) are kept in memory only.
export function buildUserMessage(text, pending) {
  const media = pending.filter((p) => p.images);
  const message = {
    id: uid(),
    role: 'user',
    text: text || (media.some((p) => p.kind === 'video')
      ? 'Analyze this video carefully: describe what happens from start to end, read any text that appears, and point out anything notable.'
      : media.length ? 'Analyze this image carefully: describe what it shows, read any text or code in it exactly, and point out anything notable.' : 'Please review the attached file.'),
    att: pending.map(({ name, kind, thumb, frames, dur, times }) => ({ name, kind, thumb, frames, dur, times })),
    extra: pending.filter((p) => p.kind === 'text').map((p) => `File "${p.name}":\n\`\`\`\n${p.text}\n\`\`\``).join('\n\n') || undefined,
  };
  return { message, images: media.flatMap((p) => p.images) };
}

const imagePart = (data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });

// Every picture gets a small label in front of it (its name, or the video frame number and time),
// so the AI knows which picture is which and when each video frame happens.
function mediaParts(media, pics) {
  if (pics.length !== media.reduce((n, a) => n + imageCount(a), 0)) return pics.map(imagePart);   // saved by an older version: no labels
  const parts = []; let k = 0;
  for (const a of media) {
    if (a.kind === 'video') {
      for (let i = 0; i < a.frames; i++, k++) {
        const at = a.times?.[i];
        parts.push({ type: 'text', text: `Video "${a.name}", frame ${i + 1} of ${a.frames}${at != null ? ` (at ${clock(at)} of ${clock(a.dur || at)})` : ''}:` });
        parts.push(imagePart(pics[k]));
      }
    } else {
      parts.push({ type: 'text', text: `Image "${a.name}":` });
      parts.push(imagePart(pics[k++]));
    }
  }
  return parts;
}

// Convert stored messages to the API format. Images live only in memory (blobs), newest first, capped
// by count and by total size (a request must stay under the ~4.5 MB that hosting such as Vercel accepts).
export function toApi(msgs, blobs) {
  const keep = new Set(); let n = 0, size = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const b = blobs[msgs[i].id];
    if (!b?.length) continue;
    const bytes = b.reduce((a, s) => a + s.length, 0);
    if (n + b.length <= MAX_IMG && size + bytes <= MEDIA_BUDGET) { keep.add(msgs[i].id); n += b.length; size += bytes; }
  }
  const out = [];
  for (const m of msgs) {
    if (m.err || (!m.text && !m.extra)) continue;
    if (m.role === 'assistant') { out.push({ role: 'assistant', content: m.text }); continue; }
    const media = (m.att || []).filter((a) => a.kind !== 'text');
    const parts = keep.has(m.id) ? mediaParts(media, blobs[m.id]) : [];
    let txt = m.text + (m.extra ? '\n\n' + m.extra : '');
    if (keep.has(m.id)) {
      txt += '\n\n[Attached: ' + media.map((a) => (a.kind === 'video'
        ? `${a.frames} frames sampled evenly in time order from the video "${a.name}" (${clock(a.dur || 0)} long, no sound)`
        : `the image "${a.name}"`)).join('; ') + '. The pictures are shown above, each one after its label.]';
    } else if (media.length) txt = '[Earlier image/video attachment is no longer available]\n' + txt;
    out.push({ role: 'user', content: [...parts, { type: 'text', text: txt }] });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.slice(-30);
}