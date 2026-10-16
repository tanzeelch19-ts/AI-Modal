// Vercel runs every file in this folder as a serverless function: this one is POST /api/chat.
import { chat } from '../server/handlers.js';

export function POST(request) {
  return chat(request);
}