// Local / own-server version: Express hands each /api request to the same handlers that Vercel uses (server/handlers.js).
// On Vercel this file is NOT used: Vercel runs the files in the api/ folder instead.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { chat, title, health } from './handlers.js';
import { describe } from './ai.js';

const app = express();
const PORT = process.env.PORT || 8787;
const MAX_BODY = 30 * 1024 * 1024;

// Turns an Express request into a web Request, calls the handler, and streams its Response back.
const route = (handler) => async (req, res) => {
  try {
    if (Number(req.headers['content-length']) > MAX_BODY) return res.status(413).json({ error: 'Attachments are too large.' });
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const headers = new Headers();
    for (const k of ['content-type', 'x-access-code']) if (req.headers[k]) headers.set(k, String(req.headers[k]));
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(`http://${req.headers.host || 'localhost'}${req.originalUrl}`, {
      method: req.method, headers, signal: ac.signal,
      ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.flushHeaders();
    if (response.body) {
      for await (const chunk of response.body) {
        if (ac.signal.aborted) break;   // leaving the loop cancels the stream, which stops the AI request
        if (!res.write(chunk)) await new Promise((resolve) => { res.once('drain', resolve); res.once('close', resolve); });
      }
    }
    res.end();
  } catch (e) {
    console.error('[api]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error. See the terminal for details.' });
    else res.end();
  }
};

app.post('/api/chat', route(chat));
app.post('/api/title', route(title));
app.get('/api/health', route(health));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

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
  const d = describe();
  console.log(`DevAI API on http://localhost:${PORT} (provider: ${d.provider})`);
  console.log(`Models, in the order they are tried: ${d.models.join(' -> ') || '(none)'}`);
  if (!d.hasKey) console.warn(`WARNING: ${d.keyName} was not found. Check that the .env file is in this folder and named exactly .env, then restart.`);
});