import { useCallback, useEffect, useRef, useState } from 'react';

const STICK = 160;   // closer than this to the bottom = "at the bottom": new text keeps scrolling along
const FAR = 240;     // farther than this from the bottom = show the "go to latest" button

const gap = (el) => el.scrollHeight - el.scrollTop - el.clientHeight;

// Keeps the scrolling area at the bottom, unless the user has scrolled up to read.
// Returns:
//   away       true when the user is far from the bottom (show the jump-to-bottom button)
//   toBottom   scrolls down to the newest message
//   stickNext  call it right before sending a message / opening a chat: the next update scrolls to the bottom whatever the position
export function AutoScroll(ref, deps) {
  const [away, setAway] = useState(false);
  const force = useRef(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (el) setAway(gap(el) > FAR);
  }, [ref]);

  // New content (a message, a streamed word): follow it down when the user is at the bottom.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (force.current || gap(el) < STICK) { el.scrollTop = el.scrollHeight; force.current = false; }
    const frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // The user scrolls, or the window changes size.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [ref, update]);

  const toBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: calm ? 'auto' : 'smooth' });
  }, [ref]);

  const stickNext = useCallback(() => { force.current = true; }, []);

  return { away, toBottom, stickNext };
}