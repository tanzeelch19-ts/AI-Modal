// Checks every API key in your .env and tells you which one is wrong. It never prints a key.
// Run in the project folder:   node check-keys.mjs
// It asks each service one tiny question that costs nothing ("list your models"), so it also works when your free limit is used up.
import 'dotenv/config';
import fs from 'node:fs';
import { describe } from './server/ai.js';

const env = (k) => String(process.env[k] ?? '').trim();
const strip = (u) => u.replace(/\/$/, '');

// The raw text of .env, to spot the usual copy-paste mistakes (quotes, spaces, "KEY=" pasted twice).
let raw = '';
try { raw = fs.readFileSync('.env', 'utf8'); } catch { /* no .env file: the values come from the real environment */ }
function mistakes(name, value) {
  const found = [];
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith(name + '='));
  const rawValue = line ? line.slice(line.indexOf('=') + 1) : value;
  if (/^\s|\s$/.test(rawValue.replace(/\s+#.*$/, ''))) found.push('there is a space before or after the key');
  if (/^["']|["']\s*$/.test(rawValue.trim())) found.push('the key is inside quotes (remove the " marks)');
  if (/^[A-Z_]+=/.test(value)) found.push('the text "' + value.split('=')[0] + '=" was pasted into the value');
  if (/\s/.test(value)) found.push('the key contains a space or a line break');
  return found;
}

async function ask(url, headers) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    return { status: r.status };
  } catch (e) {
    return { error: e?.cause?.code || e?.message || 'unknown error' };
  }
}

const geminiRoot = strip(env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/openai$/, '');
const services = [
  { name: 'Gemini', key: 'GEMINI_API_KEY', ask: (k) => ask(`${geminiRoot}/models?pageSize=1`, { 'x-goog-api-key': k }), wrong: [400, 401, 403] },
  { name: 'OpenAI (GPT)', key: 'OPENAI_API_KEY', ask: (k) => ask(`${strip(env('OPENAI_BASE_URL') || 'https://api.openai.com/v1')}/models`, { Authorization: `Bearer ${k}` }), wrong: [401, 403] },
  { name: 'Claude', key: 'ANTHROPIC_API_KEY', ask: (k) => ask(`${strip(env('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com')}/v1/models?limit=1`, { 'x-api-key': k, 'anthropic-version': '2023-06-01' }), wrong: [401, 403] },
];
for (const slot of ['FALLBACK', 'FALLBACK2', 'FALLBACK3', 'FALLBACK4']) {
  if (env(`${slot}_BASE_URL`)) services.push({ name: `Backup (${slot})`, key: `${slot}_API_KEY`, ask: (k) => ask(`${strip(env(`${slot}_BASE_URL`))}/models`, { Authorization: `Bearer ${k}` }), wrong: [401, 403] });
}

console.log('');
let bad = 0;
for (const s of services) {
  const value = env(s.key);
  const label = `${s.name.padEnd(17)} ${s.key.padEnd(18)}`;
  if (!value) { console.log(`${label} not set (skipped)`); continue; }
  const problems = mistakes(s.key, value);
  const r = await s.ask(value);
  let verdict;
  if (r.error) verdict = `could not connect (${r.error}). Check your internet connection or firewall.`;
  else if (s.wrong.includes(r.status)) { verdict = `REJECTED (HTTP ${r.status}): the service does not accept this key. It is wrong, was deleted, or was revoked. Make a new key.`; bad++; }
  else if (r.status === 429) verdict = 'accepted, but its limit is used up right now (wait, or add credit).';
  else if (r.status >= 200 && r.status < 300) verdict = 'ACCEPTED. (This does not show how much credit or free limit is left.)';
  else verdict = `unexpected answer (HTTP ${r.status}). Try again in a minute.`;
  console.log(`${label} found, ${value.length} characters -> ${verdict}`);
  for (const p of problems) console.log(`${' '.repeat(38)}! ${p}`);
}

const d = describe();
console.log('');
console.log(d.models.length
  ? `The app will try these in this order:\n  ${d.models.join('\n  ')}`
  : `The app has no model to use yet: add ${d.keyName} to .env.`);
if (bad) console.log('\nFix the REJECTED key(s) in .env (and in Vercel > Settings > Environment Variables), then restart the server / Redeploy.');
console.log('');
