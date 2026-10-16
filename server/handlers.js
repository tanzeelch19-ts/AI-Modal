// The three API routes, written with the web-standard Request/Response objects.
// Vercel calls them from the api/ folder; server/index.js (Express) calls the very same code on your computer.
import { clean, streamAnswer, makeTitle, describe } from './ai.js';


function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

// Optional access code (set ACCESS_CODE to protect the app).
function denied(request) {
  const code = String(process.env.ACCESS_CODE ?? '').trim();
  return code && request.headers.get('x-access-code') !== code ? json({ error: 'Access code required' }, 401) : null;
}

async function readJson(request) {
  try { return (await request.json()) || {}; } catch { return null; }
}

// POST /api/chat -> streamed reply (server-sent events): data: {"text"|"usage"|"model"|"error"}
export async function chat(request) {
  const no = denied(request);
  if (no) return no;
  const body = await readJson(request);
  if (!body) return json({ error: 'The request could not be read.' }, 400);
  const messages = Array.isArray(body.messages) ? clean(body.messages) : [];
  if (!messages.length || messages[0].role !== 'user') return json({ error: 'A conversation must start with a user message.' }, 400);

  const enc = new TextEncoder();
  const ac = new AbortController();
  request.signal?.addEventListener('abort', () => ac.abort(), { once: true });

  const stream = new ReadableStream({
    start(controller) {
      const send = (o) => { try { controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch { /* the browser already left */ } };
      streamAnswer(messages, ac.signal, send)
        .catch((e) => { if (!ac.signal.aborted) { console.error('[chat]', e); send({ error: e?.message || 'Something went wrong.' }); } })
        .finally(() => { try { controller.close(); } catch { /* already closed */ } });
    },
    cancel() { ac.abort(); },
  });

  // X-Accel-Buffering: tells proxies (nginx etc.) not to hold the reply back, so words show up as they are written.
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  });
}

// POST /api/title -> always { title }; it is '' when no name could be made.
export async function title(request) {
  const no = denied(request);
  if (no) return no;
  const body = (await readJson(request)) || {};
  const user = String(body.user || '').slice(0, 600);
  const reply = String(body.reply || '').slice(0, 600);
  try {
    return json({ title: String(await makeTitle(user, reply, AbortSignal.timeout(20000))).trim().slice(0, 80) });
  } catch {
    return json({ title: '' });
  }
}

// GET /api/health -> open it in the browser to check the deploy: shows whether the key was found (never the key itself).
export function health() {
  return json({ ok: true, ...describe() });
}