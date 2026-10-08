import { useRef, useState } from 'react';

// Speech-to-text into the message box (Chrome / Edge).
export function UseVoiceInput({ input, setInput, toast }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  function toggleMic() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return toast('Voice input is not supported in this browser. Try Chrome or Edge.');
    if (recRef.current) return recRef.current.stop();
    const r = new R(), base = input;
    r.lang = navigator.language || 'en-US'; r.interimResults = true;
    r.onresult = (e) => setInput((base ? base + ' ' : '') + [...e.results].map((x) => x[0].transcript).join(''));
    r.onend = () => { recRef.current = null; setListening(false); };
    r.onerror = (e) => toast(e.error === 'not-allowed' ? 'Microphone access is blocked. Allow it in your browser settings.' : e.error === 'network' ? 'Voice input needs an internet connection.' : 'Voice input failed (' + e.error + ').');
    recRef.current = r; setListening(true); r.start();
  }

  return { listening, toggleMic };
}