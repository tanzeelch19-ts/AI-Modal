// POST /api/title (the short chat name shown in the history list).
import { title } from '../server/handlers.js';

export function POST(request) {
  return title(request);
}