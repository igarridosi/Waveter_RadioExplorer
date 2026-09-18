// Relays an http:// radio stream so the HTTPS site can play it (mixed content).
//
// Written against web standards only (fetch, Request, Response, streams) so the
// same code runs as a Netlify Edge Function in production and as a Vite dev
// middleware locally. Not an open proxy: the client names a Radio Browser station
// id, never a URL; the URL is looked up server-side and must be plain http://.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOKUP_HOSTS = ['all.api.radio-browser.info', 'de1.api.radio-browser.info'];
const USER_AGENT = 'Waveter/0.2 (+https://waveter.netlify.app)';

// How much audio the relay will hold for a browser that has stopped reading
// (Chrome suspends its download whenever it has buffered enough). 4 MB is about
// four minutes at 128 kbps, well past the ~75 s after which Icecast-style servers
// drop a client that is not consuming.
export const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

export async function proxyStation(id, { fetch = globalThis.fetch, hosts = LOOKUP_HOSTS, signal } = {}) {
  if (!UUID.test(id || '')) return reply(400, 'Not a station id');

  const station = await lookup(id, { fetch, hosts, signal });
  if (!station) return reply(404, 'Unknown station');

  const url = station.url_resolved || station.url || '';
  if (!url.startsWith('http://')) return reply(400, 'Only plain http streams are relayed');
  if (isPrivateHost(new URL(url).hostname)) return reply(400, 'Refused');

  let upstream;
  try {
    upstream = await fetch(url, { signal, redirect: 'follow', headers: { 'User-Agent': USER_AGENT, 'Icy-MetaData': '0' } });
  } catch {
    return reply(502, 'The station is not responding');
  }
  if (!upstream.ok) return reply(502, `The station responded ${upstream.status}`);

  const type = (upstream.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim().toLowerCase();
  if (!isAudio(type)) return reply(502, 'The station did not send audio');

  return new Response(eagerRelay(upstream.body, { signal }), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Reads the origin continuously, at its own pace, no matter how fast the client reads.
//
// Piping the origin straight to the client propagates the client's read pauses upstream
// (back-pressure), and a live-stream server treats a client that stops reading as gone:
// measured on a Minnesota Public Radio stream, ~75 s of not reading and the socket is
// closed. So the relay itself is the steady reader, and keeps a bounded queue for the
// browser. If the browser stays away longer than the queue allows, old audio is dropped
// rather than the connection.
export function eagerRelay(body, { signal, maxBuffered = MAX_BUFFERED_BYTES } = {}) {
  const reader = body.getReader();
  let cancelled = false;
  return new ReadableStream({
    start(controller) {
      const stop = () => { cancelled = true; reader.cancel().catch(() => {}); };
      signal?.addEventListener?.('abort', stop, { once: true });
      (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (cancelled) return;
            if (done) { controller.close(); return; }
            // desiredSize goes negative once the queue holds more than the high-water mark.
            if (controller.desiredSize !== null && controller.desiredSize <= 0) continue; // client too far behind: drop
            controller.enqueue(value);
          }
        } catch (error) {
          if (!cancelled) { try { controller.error(error); } catch { /* already closed */ } }
        }
      })();
    },
    cancel() {
      cancelled = true;
      return reader.cancel().catch(() => {});
    },
  }, new ByteLengthQueuingStrategy({ highWaterMark: maxBuffered }));
}

async function lookup(id, { fetch, hosts, signal }) {
  for (const host of hosts) {
    try {
      const res = await fetch(`https://${host}/json/stations/byuuid/${id}`, { signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!res.ok) continue;
      const list = await res.json();
      return Array.isArray(list) ? list[0] : null;
    } catch {
      // try the next host
    }
  }
  return null;
}

function isAudio(type) {
  return type.startsWith('audio/') || type === 'application/ogg' || type === 'application/octet-stream';
}

// Literal addresses that must never be fetched from inside the edge network.
function isPrivateHost(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function reply(status, message) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
