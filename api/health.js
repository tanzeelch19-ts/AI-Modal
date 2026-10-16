// GET /api/health: open https://YOUR-SITE.vercel.app/api/health to see whether the deploy found the API key.
import { health } from '../server/handlers.js';

export function GET() {
  return health();
}