import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = process.env.PORT || 8787;

// ---------- Which AI to use ----------
// PROVIDER=gemini    -> Google Gemini (has a free tier, key from https://aistudio.google.com/apikey)
// PROVIDER=anthropic -> Claude (needs paid API credit)
// If PROVIDER is not set: Gemini is used when GEMINI_API_KEY exists, otherwise Claude.
const PROVIDER = (process.env.PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic')).toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GEMINI_URL = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '') + '/chat/completions';
// How much Gemini "thinks" before answering: minimal | low | medium | high.
// Lower = faster first word, higher = more careful on hard problems. Empty = model default (slowest).
const THINKING = (process.env.GEMINI_THINKING ?? 'low').trim().toLowerCase();
const EFFORT = ['', 'default'].includes(THINKING) ? '' : THINKING;
const CLAUDE_MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const MODEL_NAME = PROVIDER === 'gemini' ? GEMINI_MODEL : CLAUDE_MODEL;
const claude = PROVIDER === 'anthropic' ? new Anthropic() : null; // reads ANTHROPIC_API_KEY

const systemPrompt = () => `You are DevAI, a smart, accurate and helpful AI assistant. You answer any kind of question (general knowledge, study, writing, maths, daily life) and you are especially strong at programming. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

How to answer:
- Accuracy comes first. Think carefully before answering. If you are not sure, or the question is about something recent that you may not know, say so plainly. Never invent facts, numbers, links, libraries, functions or API options. You have no internet access.
- Start with the answer, then explain briefly. Match the length to the question: short for simple questions, detailed for hard ones. No filler and no repeating the question.
- Use markdown: short paragraphs, lists only where they help, and fenced code blocks with a language tag.
- Code: give complete, correct, runnable code (with imports and any needed setup), using current idiomatic practice for the language and framework the user is using. Mention version assumptions when they matter. Handle errors and edge cases, and point out security problems you notice. When the user shows code, keep their style and names, find the real root cause, show the fixed code and explain in one or two lines why it works.
- If a request is ambiguous and a wrong guess would waste the user's time, ask one short question. Otherwise make a sensible assumption and say what it is.
- For maths and logic, work step by step and double-check the result.
- You can see images the user attaches, and frames sampled from attached videos: describe only what is actually visible, read visible text and code carefully, and say when something is unclear. You cannot hear audio.
- Reply in the language the user writes in (including Roman Urdu or Hinglish if they write that way).`;

app.use(express.json({ limit: '30mb' }));

// Optional access code (set ACCESS_CODE in .env to protect the app)
app.use('/api', (req, res, next) => {
  const code = process.env.ACCESS_CODE;
  if (code && req.get('x-access-code') !== code) return res.status(401).json({ error: 'Access code required' });
  next();
});

// ---------- Clean the messages sent by the browser ----------
const IMG = 'image/jpeg';
function clean(messages) {
  return messages.slice(-40).map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    if (typeof m.content === 'string') return { role, content: m.content };
    const parts = (Array.isArray(m.content) ? m.content : []).flatMap((p) => {
      if (p?.type === 'text' && typeof p.text === 'string') return [{ type: 'text', text: p.text }];
      if (p?.type === 'image' && p.source?.type === 'base64' && p.source.media_type === IMG) return [{ type: 'image', source: { type: 'base64', media_type: IMG, data: String(p.source.data) } }];
      return [];
    });
    return { role, content: parts };
  }).filter((m) => m.content.length);
}

// ---------- Claude (Anthropic) ----------
function claudeError(e) {
  if (e?.status === 401) return 'The server API key is missing or invalid. Check ANTHROPIC_API_KEY in .env.';
  if (e?.status === 429) return 'Rate limit reached. Wait a moment and press Retry.';
  if (e?.status === 529 || e?.status >= 500) return 'The AI service is busy. Press Retry in a few seconds.';
  if (e?.status === 400) return 'The request was rejected: ' + (e.message || 'bad request');
  return e?.message || 'Something went wrong.';
}

async function streamClaude(messages, signal, send) {
  try {
    const stream = claude.messages.stream({ model: CLAUDE_MODEL, max_tokens: 8192, system: systemPrompt(), messages }, { signal });
    stream.on('text', (t) => send({ text: t }));
    const final = await stream.finalMessage();
    send({ usage: final.usage });
  } catch (e) {
    if (!signal.aborted) send({ error: claudeError(e) });
  }
}

// ---------- Gemini (Google, OpenAI-compatible endpoint) ----------
function toGeminiMessages(messages) {
  const out = [{ role: 'system', content: systemPrompt() }];
  for (const m of messages) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    out.push({
      role: m.role,
      content: m.content.map((p) => (p.type === 'image'
        ? { type: 'image_url', image_url: { url: `data:${IMG};base64,${p.source.data}` } }
        : { type: 'text', text: p.text })),
    });
  }
  return out;
}

function geminiError(status, body) {
  let msg = '';
  try {
    const j = JSON.parse(body);
    msg = (Array.isArray(j) ? j[0] : j)?.error?.message || '';
  } catch { msg = String(body || '').slice(0, 200); }
  if (status === 401 || status === 403 || /api key/i.test(msg)) return 'The Gemini API key is missing or invalid. Check GEMINI_API_KEY in .env, then restart the server.';
  if (status === 429) return 'Free Gemini limit reached (per minute or per day). Wait a minute and press Retry. If it keeps happening, set GEMINI_MODEL=gemini-3.5-flash-lite in .env.';
  if (status === 404) return `Gemini model "${GEMINI_MODEL}" was not found. Check GEMINI_MODEL in .env.`;
  if (status >= 500) return 'The Gemini service is busy. Press Retry in a few seconds.';
  return `The request was rejected (${status}): ${msg || 'bad request'}`;
}

let effortRejected = false;

async function streamGemini(messages, signal, send) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send({ error: 'GEMINI_API_KEY is missing. Add it to the .env file, then restart the server.' });
  const call = (effort) => fetch(GEMINI_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: toGeminiMessages(messages),
      stream: true,
      stream_options: { include_usage: true },
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  try {
    let r = await call(effortRejected ? '' : EFFORT);
    if (r.status === 400 && EFFORT && !effortRejected) {
      const body = await r.text().catch(() => '');
      if (!/reason|think/i.test(body)) return send({ error: geminiError(400, body) });
      // This model does not accept reasoning_effort: remember that, so the next messages skip the failed try.
      effortRejected = true;
      console.warn(`Model ${GEMINI_MODEL} does not accept GEMINI_THINKING=${EFFORT}. Continuing without it.`);
      r = await call('');
    }
    if (!r.ok || !r.body) return send({ error: geminiError(r.status, await r.text().catch(() => '')) });

    const dec = new TextDecoder();
    let buf = '';
    let usage = null;
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let m;
      while ((m = /\r?\n\r?\n/.exec(buf))) {
        const block = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        for (const line of block.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let ev;
          try { ev = JSON.parse(data); } catch { continue; }
          const err = (Array.isArray(ev) ? ev[0] : ev)?.error;
          if (err) return send({ error: geminiError(err.code || 500, JSON.stringify({ error: err })) });
          const text = ev.choices?.[0]?.delta?.content;
          if (text) send({ text });
          if (ev.usage) usage = { input_tokens: ev.usage.prompt_tokens || 0, output_tokens: ev.usage.completion_tokens || 0 };
        }
      }
    }
    if (usage) send({ usage });
  } catch (e) {
    if (!signal.aborted) send({ error: e?.message || 'Could not reach Gemini. Check your internet connection.' });
  }
}

// ---------- API ----------
app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? clean(req.body.messages) : [];
  if (!messages.length || messages[0].role !== 'user') return res.status(400).json({ error: 'A conversation must start with a user message.' });

  // X-Accel-Buffering: tells hosting proxies (nginx etc.) not to hold the reply back; words show up as they are written.
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  await (PROVIDER === 'gemini' ? streamGemini : streamClaude)(messages, ac.signal, send);
  res.end();
});

// Serve the built client in production
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.use(express.static(dist));
app.use((req, res) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html'), (err) => err && res.status(404).end()) : res.status(404).end()));

app.listen(PORT, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use. Another copy of the server is still running - close that terminal (or stop that process) and try again.`
      : `Could not start the server: ${err.message}`);
    process.exit(1);
  }
  console.log(`DevAI API on http://localhost:${PORT} (provider: ${PROVIDER}, model: ${MODEL_NAME}${PROVIDER === 'gemini' ? `, thinking: ${EFFORT || 'default'}` : ''})`);
  const keyName = PROVIDER === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
  if (!process.env[keyName]) console.warn(`WARNING: ${keyName} was not found. Check that the .env file is in this folder and named exactly .env, then restart.`);
});