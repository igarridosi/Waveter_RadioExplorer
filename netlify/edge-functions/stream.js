// GET /stream/:id  ->  relays the http:// stream of a Radio Browser station.
// Runs at the edge (Deno) so the response can stream for as long as the listener stays.
import { proxyStation } from '../../src/streamProxy/proxy.js';

export default async function handler(request, context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }
  return proxyStation(context.params.id, { signal: request.signal });
}

export const config = { path: '/stream/:id', cache: 'manual' };
