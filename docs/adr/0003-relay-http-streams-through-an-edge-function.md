# ADR-0003: http:// streams are relayed through an edge function

Date: 2026-09-14
Status: accepted. Amends ADR-0001 (the site stays static; the "HTTPS only" rule is lifted).

## Context

ADR-0001 dropped every `http://` stream to avoid running a backend. In practice that removed about
a quarter of the catalogue, including the most popular Spanish stations (Cadena SER, Cadena 100,
Rock FM) and the README's own recommendation (A.D.M. Hardstyle Radio, Assen). A browser on an
HTTPS page blocks those streams as mixed content; nothing client-side can play them.

Two facts made a relay viable:
- Modern Icecast/Shoutcast servers answer with a proper `HTTP/1.1 200` status line; a probe of
  A.D.M. plus the 12 most voted Spanish http stations succeeded 13/13 through `fetch`.
- Netlify Edge Functions stream responses: their documented limits are 50 ms of CPU per request
  and 40 s to send response headers, with no stated limit on how long a streamed body may run.

## Decision

- `GET /stream/:id` relays the stream of one Radio Browser station. It is served by a Netlify Edge
  Function in production (`netlify/edge-functions/stream.js`) and by a Vite middleware in
  development (`vite.config.js`); both call the same web-standard core `src/streamProxy/proxy.js`.
- It is not an open proxy. The client sends a station id, never a URL. The relay looks the URL up
  in Radio Browser server-side, refuses anything that is not `http://`, refuses loopback/private
  hosts, and refuses upstreams that do not answer with an audio content type.
- The catalogue is created with `httpProxy: station => \`/stream/${station.id}\``. With a relay
  configured it stops asking the API for `is_https=true`, marks http stations as playable, and
  `streamFor` returns the relay URL for them. Without a relay (tests, fixture) the ADR-0001
  behaviour stands unchanged. HLS stays excluded (ADR-0002).

## Amendment (2026-09-18): the relay reads eagerly

Piping the origin straight to the client propagated the browser's read pauses upstream. Chrome
suspends a media download whenever it has buffered enough, and live-stream servers drop a client
that stops reading: measured on Minnesota Public Radio, the origin queues ~1.2 MB (~75 s at
128 kbps) and then closes the socket (45 s of not reading survived, 120 s did not). That was the
"station stops after a few minutes" bug. `eagerRelay` in `src/streamProxy/proxy.js` now reads the
origin continuously and keeps a bounded queue (`MAX_BUFFERED_BYTES`, 4 MB) for the client; if the
client stays away longer than that, old audio is dropped, never the connection. Verified: 150 s
without reading through the relay, stream still alive.

## Consequences

- Roughly 23 % more stations, including the ones listeners actually look for.
- Bandwidth of every http listener flows through Netlify's edge; invocation counts and bandwidth
  are billed on the team plan. The 40 s header timeout means a station that takes longer than that
  to start answering fails with 502 and the player shows "not responding".
- To confirm on the first deploy: a stream still playing after several minutes (the body limit is
  undocumented, not guaranteed).
- The relay strips ICY metadata (`Icy-MetaData: 0`), so "now playing" song titles are not available
  through it; that would be a separate feature.
