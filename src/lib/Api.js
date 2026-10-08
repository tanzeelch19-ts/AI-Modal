// Sends the chat to the server and reads the streamed (SSE) reply.
// onText(chunk) is called for each piece of text, onUsage({input_tokens, output_tokens}) at the end.
export async function streamChat({ messages, signal, onText, onUsage }) {
  const res = await fetch('/api/chat', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-access-code': localStorage.getItem('devai:code') || '' },
    body: JSON.stringify({ messages }),
  });
  if (res.status === 401) {
    const c = prompt('Access code:');
    if (c) localStorage.setItem('devai:code', c);
    throw new Error('Access code required. Press Retry.');
  }
  if (!res.ok || !res.body) throw new Error(res.status === 413 ? 'Attachments are too large.' : `Server error (${res.status}). Is the server running?`);

  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (!line.startsWith('data: ')) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.error) throw new Error(ev.error);
      if (ev.text) onText(ev.text);
      if (ev.usage) onUsage(ev.usage);
    }
  }
}