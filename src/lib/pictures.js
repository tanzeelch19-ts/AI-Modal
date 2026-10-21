
// Pictures and video for the AI: limits, and turning an image or a video into small JPEG pictures.
// Sizes below are base64 characters. Hosting such as Vercel accepts about 4.5 MB per request, so all pictures of one request stay under 3.6 MB.
export const MAX_IMG = 12;              // pictures per message (video frames count too)
export const IMG_CAP = 600_000;         // one picture
export const FRAME_CAP = 250_000;       // one video frame
export const MEDIA_BUDGET = 3_600_000;  // all pictures together

// Draw an image/video frame on a canvas and return base64 JPEG (no "data:" prefix).
export function toB64(src, w, h, max, q) {
  const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q).split(',')[1];
}

// [longest side in px, JPEG quality]: tried from the sharpest down, until the picture is small enough.
// Hosting limits a request to about 4.5 MB, so a big photo is shrunk just enough to fit, never more.
const IMAGE_STEPS = [[1568, 0.85], [1400, 0.8], [1200, 0.75], [1000, 0.7], [800, 0.65], [640, 0.6]];
const FRAME_STEPS = [[1280, 0.85], [1120, 0.8], [960, 0.75], [800, 0.7], [640, 0.65], [512, 0.6]];

function fit(src, w, h, steps, cap) {
  let out = '';
  for (const [max, q] of steps) {
    out = toB64(src, w, h, max, q);
    if (out.length <= cap) break;
  }
  return out;
}

// cap = the most base64 characters this one picture may use.
export async function readImage(file, cap = IMG_CAP) {
  const bm = await createImageBitmap(file);
  try {
    return { images: [fit(bm, bm.width, bm.height, IMAGE_STEPS, cap)], thumb: toB64(bm, bm.width, bm.height, 140, 0.6) };
  } finally { bm.close?.(); }
}

// A frame that has not been drawn yet comes out as one flat colour. Looks at a tiny copy of the current frame.
function looksBlank(v) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(v, 0, 0, 16, 16);
  const d = x.getImageData(0, 0, 16, 16).data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < lo) lo = l; if (l > hi) hi = l; }
  return hi - lo < 6;
}

// Sample frames evenly from a video file: about one every 3 seconds, at least 6 and at most `max`.
// Returns the frames, the time (in seconds) of each frame, and the length of the video.
export function readVideo(file, { max = 6, cap = FRAME_CAP } = {}) {
  return new Promise((res, rej) => {
    const v = document.createElement('video'), url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = (m) => { URL.revokeObjectURL(url); rej(new Error(m)); };
    v.onerror = () => fail('This video format cannot be read by the browser. Try MP4 or WebM.');
    v.onloadedmetadata = async () => {
      const d = v.duration;
      if (!isFinite(d) || !d || !v.videoWidth) return fail('Could not read this video.');
      const n = Math.max(1, Math.min(max, Math.max(6, Math.ceil(d / 3))));
      const images = [], times = [];
      try {
        for (let i = 0; i < n; i++) {
          const at = d * (i + 0.5) / n;
          await new Promise((r, j) => {
            const t = setTimeout(() => j(new Error('Video seek timed out.')), 15000);
            v.onseeked = () => { clearTimeout(t); r(); };
            v.currentTime = at;
          });
          await new Promise((r) => setTimeout(r, 60));
          for (let k = 0; k < 4 && looksBlank(v); k++) await new Promise((r) => setTimeout(r, 200));   // give the picture time to appear
          images.push(fit(v, v.videoWidth, v.videoHeight, FRAME_STEPS, cap));
          times.push(Math.round(at * 10) / 10);
        }
      } catch (e) { return fail(e.message); }
      const thumb = toB64(v, v.videoWidth, v.videoHeight, 140, 0.6);
      URL.revokeObjectURL(url);
      res({ images, times, thumb, dur: d });
    };
  });
}