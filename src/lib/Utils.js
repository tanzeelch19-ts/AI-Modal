export const uid = () => crypto.randomUUID();

// Join class names, skipping falsy values: cn('a', cond && 'b')
export const cn = (...parts) => parts.filter(Boolean).join(' ');

export const copyText = async (s) => {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
};

export function speak(text, toast) {
  if (!('speechSynthesis' in window)) return toast('Text-to-speech is not supported here.');
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, ' code block. ')));
}