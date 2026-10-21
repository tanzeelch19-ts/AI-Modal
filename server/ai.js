// The AI part of DevAI: builds the reply, and moves on to the next model by itself when one
// has used up its free quota or is busy. There is no web-server code in this file, so it runs
// the same on your computer (Express, server/index.js) and on Vercel (the api/ functions).
const IMG = 'image/jpeg';
const env = (k, d = '') => String(process.env[k] ?? d).trim();
const isOn = (k) => ['on', 'true', '1', 'yes'].includes(env(k).toLowerCase());
const isOff = (k) => ['off', 'false', '0', 'no', 'none'].includes(env(k).toLowerCase());

export const systemPrompt = () => `You are DevAI, a smart, accurate and helpful AI assistant. You answer any kind of question (general knowledge, study, writing, maths, daily life) and you are especially strong at programming. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

How to answer:
- Accuracy comes first. Think carefully before answering. If you are not sure, or the question is about something recent that you may not know, say so plainly. Never invent facts, numbers, links, libraries, functions or API options. You have no internet access.
- Start with the answer, then explain briefly. Match the length to the question: short for simple questions, detailed for hard ones. No filler and no repeating the question.
- Use markdown: short paragraphs, lists only where they help, and fenced code blocks with a language tag.
- Code: give complete, correct, runnable code (with imports and any needed setup), using current idiomatic practice for the language and framework the user is using. Mention version assumptions when they matter. Handle errors and edge cases, and point out security problems you notice. When the user shows code, keep their style and names, find the real root cause, show the fixed code and explain in one or two lines why it works.
- If a request is ambiguous and a wrong guess would waste the user's time, ask one short question. Otherwise make a sensible assumption and say what it is.
- For maths and logic, work step by step and double-check the result.
- Images and video: you can see images the user attaches, and frames sampled from attached videos (each frame is labelled with its number and time; you cannot hear audio and you do not see the motion between frames). Look carefully before answering. Note what is really visible (objects, people, text, screens, code, numbers, colours, setting), read any text or code exactly as written, and for a video describe what changes from frame to frame, using the times. Say plainly what you cannot tell (unclear, cut off, too small, or between frames). Never invent details, and do not name real people from their faces. Then answer exactly what the user asked, giving the answer first when they asked a question.
- Reply in the language the user writes in (including Roman Urdu or Hinglish if they write that way).`;

// ---------- Clean the messages sent by the browser ----------
export function clean(messages) {
  return messages.slice(-40).map((m) => {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    if (typeof m?.content === 'string') return { role, content: m.content };
    const parts = (Array.isArray(m?.content) ? m.content : []).flatMap((p) => {
      if (p?.type === 'text' && typeof p.text === 'string') return [{ type: 'text', text: p.text }];
      if (p?.type === 'image' && p.source?.type === 'base64' && p.source.media_type === IMG) return [{ type: 'image', source: { type: 'base64', media_type: IMG, data: String(p.source.data) } }];
      return [];
    });
    return { role, content: parts };
  }).filter((m) => m.content.length);
}

// ---------- Which models can answer, in the order they are tried ----------
// 1. Gemini models: GEMINI_MODEL first, then GEMINI_FALLBACK_MODELS (all use the same free key, but each model has its own free limit).
// 2. OpenAI (GPT): OPENAI_API_KEY (+ OPENAI_MODEL). Then optional other backup providers (any OpenAI-compatible API, up to four): FALLBACK_BASE_URL + FALLBACK_API_KEY + FALLBACK_MODEL (then FALLBACK2_..., FALLBACK3_..., FALLBACK4_...).
// 3. Optional Claude (paid): used last only when FALLBACK_TO_CLAUDE=on. With PROVIDER=anthropic, Claude is first instead.
const DEFAULT_GEMINI_FALLBACKS = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite';

export const provider = () => (env('PROVIDER') || (env('GEMINI_API_KEY') ? 'gemini' : 'anthropic')).toLowerCase();

function geminiTargets() {
  const key = env('GEMINI_API_KEY');
  if (!key) return [];
  const base = (env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/$/, '');
  const thinking = env('GEMINI_THINKING', 'low').toLowerCase();
  const effort = ['', 'default'].includes(thinking) ? '' : thinking;
  const imgThinking = env('GEMINI_THINKING_IMAGES', 'medium').toLowerCase();   // used when the chat contains pictures or video frames
  const imageEffort = ['', 'default'].includes(imgThinking) ? '' : imgThinking;
  const fallbacks = isOff('GEMINI_FALLBACK_MODELS') ? [] : (env('GEMINI_FALLBACK_MODELS') || DEFAULT_GEMINI_FALLBACKS).split(',');
  const models = [...new Set([env('GEMINI_MODEL') || 'gemini-3.8-flash', ...fallbacks].map((s) => s.trim()).filter(Boolean))];
  return models.map((model) => ({
    id: `gemini:${model}`, label: `Gemini ${model}`, kind: 'openai', model, key, keyId: 'gemini', keyName: 'GEMINI_API_KEY',
    url: `${base}/chat/completions`, effort, imageEffort, titleEffort: 'minimal', vision: true,
  }));
}

// OpenAI (GPT). Needs only OPENAI_API_KEY; OPENAI_MODEL (default gpt-6.1-sol) may list several models separated by commas.
// Pictures are allowed unless you set OPENAI_VISION=off. OPENAI_BASE_URL is only for an OpenAI-compatible service other than OpenAI.
function openaiTargets() {
  const key = env('OPENAI_API_KEY');
  if (!key) return [];
  const base = (env('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');
  const models = [...new Set((env('OPENAI_MODEL') || 'gpt-6.1-sol').split(',').map((m) => m.trim()).filter(Boolean))];
  return models.map((model) => ({
    id: `openai:${model}`, label: model, kind: 'openai', model, key, keyId: 'openai', keyName: 'OPENAI_API_KEY',
    url: `${base}/chat/completions`, effort: '', imageEffort: '', titleEffort: '', vision: !isOff('OPENAI_VISION'),
  }));
}

// Backup providers (any OpenAI-compatible API, for example OpenAI itself). Up to four, each with its own key:
//   FALLBACK_*  FALLBACK2_*  FALLBACK3_*  FALLBACK4_*   (BASE_URL, API_KEY, MODEL, VISION). MODEL may list several models, separated by commas.
function extraTargets() {
  const out = [];
  for (const slot of ['FALLBACK', 'FALLBACK2', 'FALLBACK3', 'FALLBACK4']) {
    const base = env(`${slot}_BASE_URL`), key = env(`${slot}_API_KEY`), models = env(`${slot}_MODEL`);
    if (!base || !key || !models) continue;
    const id = slot === 'FALLBACK' ? 'extra' : slot.replace('FALLBACK', 'extra');
    for (const model of [...new Set(models.split(',').map((m) => m.trim()).filter(Boolean))]) {
      out.push({
        id: `${id}:${model}`, label: model, kind: 'openai', model, key, keyId: id, keyName: `${slot}_API_KEY`,
        url: `${base.replace(/\/$/, '')}/chat/completions`, effort: '', imageEffort: '', titleEffort: '',
        vision: isOn(`${slot}_VISION`),   // images are only sent to these models when you say they can read them
      });
    }
  }
  return out;
}

function claudeTargets() {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) return [];
  const model = env('MODEL') || 'claude-sonnet-5-5';
  return [{ id: 'claude', label: `Claude ${model}`, kind: 'claude', model, key, keyId: 'claude', keyName: 'ANTHROPIC_API_KEY', vision: true }];
}

export function chain() {
  const gemini = geminiTargets(), openai = openaiTargets(), extra = extraTargets(), claude = claudeTargets();
  return provider() === 'gemini'
    ? [...gemini, ...openai, ...extra, ...(isOn('FALLBACK_TO_CLAUDE') ? claude : [])]
    : [...claude, ...gemini, ...openai, ...extra];
}

// Short description for logs and the /api/health page (never includes a key).
export function describe() {
  const targets = chain();
  const keyName = env('PROVIDER').toLowerCase() === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';   // the key to add when nothing is configured
  return { provider: provider(), keyName, hasKey: targets.length > 0, models: targets.map((t) => t.label) };
}

// ---------- What happened to a model, and how to tell the user ----------
// kind: auth (bad key) | quota (free limit used up) | missing (wrong model name) | busy (try again) | empty | bad (the request itself was refused)
class Fail extends Error {
  constructor(kind, message, wait = 0) { super(message); this.kind = kind; this.wait = wait; }
}

const bodyMessage = (body) => {
  try {
    const j = JSON.parse(body);
    return (Array.isArray(j) ? j[0] : j)?.error?.message || '';
  } catch { return String(body || '').slice(0, 200); }
};

function classify(status, body) {
  const text = String(body || '');
  if (status === 401 || status === 403 || /api[ _-]?key/i.test(text)) return 'auth';
  if (status === 429 || /credit balance|RESOURCE_EXHAUSTED/i.test(text)) return 'quota';
  if (status === 404) return 'missing';
  if (status === 408 || status === 529 || status >= 500) return 'busy';
  return 'bad';
}

// How long to leave a model alone after it said "limit reached".
function quotaWait(body) {
  const text = String(body || '');
  if (/PerDay|credit balance/i.test(text)) return 30 * 60_000;   // daily limit / no credit: look again later
  const s = /retry(?:Delay"?:?\s*"?|\s+in\s+)(\d+(?:\.\d+)?)s/i.exec(text);
  return Math.min(10 * 60_000, Math.max(5_000, s ? Math.ceil(Number(s[1]) * 1000) : 60_000));
}

function failFrom(t, status, body) {
  const kind = classify(status, body);
  const msg = bodyMessage(body);
  const text = {
    auth: `The ${t.label} API key is missing or invalid. Check ${t.keyName} (in the .env file on your computer, or in Vercel > Settings > Environment Variables), then restart or redeploy.`,
    quota: `${t.label} has reached its limit.`,
    missing: `The model "${t.model}" was not found. Check the model name in your settings.`,
    busy: `${t.label} is busy right now.`,
    bad: `The request was rejected (${status}): ${msg || 'bad request'}`,
  }[kind];
  return new Fail(kind, text, kind === 'quota' ? quotaWait(body) : 0);
}

const whyFailed = (e) => e?.cause?.code || e?.code || e?.message || 'unknown error';
const pause = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
});

// ---------- Per-model memory (lives as long as the server process; on Vercel, as long as the instance) ----------
const cooldown = new Map();   // model id -> time it may be used again
const effortNow = new Map();  // model id -> thinking level this model accepts ('' = none). Starts from the setting, steps down when refused.

const isReady = (t) => (cooldown.get(t.id) || 0) <= Date.now();
const readyFirst = (list) => [...list.filter(isReady), ...list.filter((t) => !isReady(t))];

// ---------- OpenAI-compatible streaming (Gemini and any second provider) ----------
function toOpenAI(messages) {
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

async function openaiStream(t, messages, signal, send, images = false) {
  const call = (effort) => fetch(t.url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({
      model: t.model,
      messages: toOpenAI(messages),
      stream: true,
      stream_options: { include_usage: true },
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  const ekey = images ? `${t.id}:img` : t.id;   // pictures may use a different thinking level than plain text
  let effort = effortNow.has(ekey) ? effortNow.get(ekey) : (images ? t.imageEffort : t.effort);
  let r = await call(effort);
  while (r.status === 400 && effort) {
    const body = await r.text().catch(() => '');
    if (!/reason|think/i.test(body)) throw failFrom(t, 400, body);
    // This model does not accept that thinking level (for example "minimal"): use the closest one it accepts, and remember it.
    const next = effort === 'minimal' ? 'low' : '';
    console.warn(`[ai] ${t.model} does not accept thinking level "${effort}". Using ${next ? `"${next}"` : 'its default'}.`);
    effortNow.set(ekey, next);
    effort = next;
    r = await call(effort);
  }
  if (!r.ok || !r.body) throw failFrom(t, r.status, await r.text().catch(() => ''));

  const dec = new TextDecoder();
  let buf = '', usage = null, got = false;
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
        if (err) throw failFrom(t, err.code || 500, JSON.stringify({ error: err }));
        const text = ev.choices?.[0]?.delta?.content;
        if (text) { got = true; send({ text }); }
        if (ev.usage) usage = { input_tokens: ev.usage.prompt_tokens || 0, output_tokens: ev.usage.completion_tokens || 0 };
      }
    }
  }
  if (!got) throw new Fail('empty', `${t.label} returned an empty reply.`);
  if (usage) send({ usage });
}

// ---------- Claude (Anthropic) streaming ----------
let claudeClient;
async function claude(key) {   // loaded only when Claude is really used, which keeps the Gemini-only start-up fast
  if (!claudeClient) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); claudeClient = new Anthropic({ apiKey: key }); }
  return claudeClient;
}

async function claudeStream(t, messages, signal, send) {
  try {
    const stream = (await claude(t.key)).messages.stream({ model: t.model, max_tokens: 8192, system: systemPrompt(), messages }, { signal });
    stream.on('text', (x) => send({ text: x }));
    const final = await stream.finalMessage();
    send({ usage: final.usage });
  } catch (e) {
    if (signal.aborted || !e?.status) throw e;
    throw failFrom(t, e.status, e.message);
  }
}

// ---------- The reply: try the models one after another ----------
const hasImages = (messages) => messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image'));

function finalMessage(fails) {
  const by = (k) => fails.find((f) => f.kind === k);
  if (fails.every((f) => f.kind === 'quota')) {
    return 'Every available model has reached its free limit for now (per-minute or per-day limits). Wait a minute and press Retry. Daily limits reset at midnight Pacific time. To get more room, add a second provider key (see .env.example).';
  }
  const f = by('auth') || by('missing') || by('busy') || by('empty') || fails[0];
  return f.kind === 'busy' ? 'The AI services are busy right now. Press Retry in a few seconds.' : f.message;
}

export async function streamAnswer(messages, signal, send) {
  const all = chain();
  if (!all.length) {
    const { keyName } = describe();
    return send({ error: `${keyName} was not found. On your computer: add it to the .env file and restart the server. On Vercel: add it in Project > Settings > Environment Variables, then redeploy.` });
  }
  const usable = hasImages(messages) ? all.filter((t) => t.vision) : all;
  if (!usable.length) return send({ error: 'This chat contains an image, but none of the configured models can read images. Start a new chat without the image.' });

  const pictures = hasImages(messages);
  const isLite = (t) => /lite/i.test(t.model);
  // For pictures and video accuracy matters most: the small "lite" models are only used after the bigger ones.
  const ordered = readyFirst(pictures ? [...usable.filter((t) => !isLite(t)), ...usable.filter(isLite)] : usable);
  const more = ordered.length > 1;   // when another model can answer, a busy model is skipped at once instead of waited for
  const authFailed = new Set();
  const fails = [];
  let sent = false;   // true once the first words reached the browser: after that we never start over on another model
  let current, first = 0;
  const t0 = Date.now();
  const out = (o) => {
    if (o.text && !sent) { sent = true; first = Date.now() - t0; send({ model: current.label, ms: first }); }
    send(o);
  };

  for (const t of ordered) {
    if (authFailed.has(t.keyId)) continue;
    current = t;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await (t.kind === 'claude' ? claudeStream : openaiStream)(t, messages, signal, out, pictures);
        console.log(`[ai] ${t.label}: first word after ${first} ms, finished after ${Date.now() - t0} ms`);
        return;
      } catch (e) {
        if (signal.aborted) return;
        const dropped = !(e instanceof Fail);   // the connection itself failed (for example an idle connection that was closed)
        const f = dropped ? new Fail('busy', `Could not reach ${t.label} (${whyFailed(e)}). Check your internet connection, then press Retry.`) : e;
        if (sent) return send({ error: f.message });
        console.warn(`[ai] ${t.label}: ${f.kind} - ${f.message}`);
        if (dropped && attempt + 1 < (more ? 2 : 3)) { await pause(attempt ? 1000 : 150, signal); continue; }
        if (!dropped && f.kind === 'busy' && !more && attempt + 1 < 3) { await pause(attempt ? 1500 : 500, signal); continue; }
        if (f.kind === 'bad') return send({ error: f.message });   // the request itself is wrong: another model will not help
        fails.push(f);
        if (f.kind === 'quota') cooldown.set(t.id, Date.now() + f.wait);
        if (f.kind === 'missing') cooldown.set(t.id, Date.now() + 10 * 60_000);
        if (f.kind === 'busy' || f.kind === 'empty') cooldown.set(t.id, Date.now() + 20_000);
        if (f.kind === 'auth') { authFailed.add(t.keyId); usable.filter((x) => x.keyId === t.keyId).forEach((x) => cooldown.set(x.id, Date.now() + 2 * 60_000)); }
        break;   // next model
      }
    }
  }
  send({ error: finalMessage(fails) });
}

// ---------- Chat names (the short title shown in the history list) ----------
// One tiny extra request after the first reply of a new chat. Set AI_TITLES=off to skip it.
const TITLE_RULES = 'Write a short title for this chat: 2 to 5 words, at most 40 characters, in the same language and script as the user message. Reply with the title only: no quotes, no full stop, no markdown.';

async function openaiTitle(t, prompt, signal) {
  const call = (effort) => fetch(t.url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.key}` },
    body: JSON.stringify({
      model: t.model,
      messages: [{ role: 'system', content: TITLE_RULES }, { role: 'user', content: prompt }],
      max_tokens: 1024,   // thinking models count their thinking in this too, so leave plenty of room (the title itself is a few words)
      ...(effort ? { reasoning_effort: effort } : {}),
    }),
  });
  const tkey = `${t.id}:title`;
  let effort = effortNow.has(tkey) ? effortNow.get(tkey) : t.titleEffort;
  let r = await call(effort);
  while (r.status === 400 && effort) {   // this model does not accept that level: step down and remember
    effort = effort === 'minimal' ? 'low' : '';
    effortNow.set(tkey, effort);
    r = await call(effort);
  }
  if (!r.ok) throw failFrom(t, r.status, await r.text().catch(() => ''));
  return (await r.json()).choices?.[0]?.message?.content || '';
}

async function claudeTitle(t, prompt, signal) {
  const r = await (await claude(t.key)).messages.create({ model: t.model, max_tokens: 40, system: TITLE_RULES, messages: [{ role: 'user', content: prompt }] }, { signal });
  return r.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

// Returns the title, or '' when no name could be made (the browser then keeps its own quick name).
export async function makeTitle(user, reply, signal) {
  if (isOff('AI_TITLES') || !String(user).trim()) return '';
  const prompt = `User message:\n${user}\n\nAssistant reply:\n${reply}`;
  for (const t of chain().filter(isReady).slice(0, 2)) {   // never spend a request on a model that just ran out
    if (signal.aborted) break;
    try {
      const title = String(await (t.kind === 'claude' ? claudeTitle : openaiTitle)(t, prompt, signal)).trim();
      if (title) return title.slice(0, 80);
    } catch (e) {
      if (e instanceof Fail && e.kind === 'quota') cooldown.set(t.id, Date.now() + e.wait);
    }
  }
  return '';
}