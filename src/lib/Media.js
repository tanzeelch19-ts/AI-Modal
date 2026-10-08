// Draw an image/video frame on a canvas and return base64 JPEG (no "data:" prefix).
export function toB64(src, w, h, max, q) {
  const s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q).split(',')[1];
}

export async function readImage(file) {
  const bm = await createImageBitmap(file);
  return { images: [toB64(bm, bm.width, bm.height, 1568, 0.85)], thumb: toB64(bm, bm.width, bm.height, 140, 0.6) };
}

// Sample n frames evenly from a video file.
export function readVideo(file, n = 6) {
  return new Promise((res, rej) => {
    const v = document.createElement('video'), url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = (m) => { URL.revokeObjectURL(url); rej(new Error(m)); };
    v.onerror = () => fail('This video format cannot be read by the browser. Try MP4 or WebM.');
    v.onloadedmetadata = async () => {
      const d = v.duration;
      if (!isFinite(d) || !d || !v.videoWidth) return fail('Could not read this video.');
      const images = [];
      try {
        for (let i = 0; i < n; i++) {
          await new Promise((r, j) => {
            const t = setTimeout(() => j(new Error('Video seek timed out.')), 15000);
            v.onseeked = () => { clearTimeout(t); r(); };
            v.currentTime = d * (i + 0.5) / n;
          });
          images.push(toB64(v, v.videoWidth, v.videoHeight, 1280, 0.85));
        }
      } catch (e) { return fail(e.message); }
      const thumb = toB64(v, v.videoWidth, v.videoHeight, 140, 0.6);
      URL.revokeObjectURL(url);
      res({ images, thumb, dur: d });
    };
  });
}