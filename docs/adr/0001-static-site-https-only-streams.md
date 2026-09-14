# ADR-0001: Waveter is a static site and plays HTTPS streams only

Date: 2026-09-14
Status: accepted

## Context

The original catalogue provider (radio.garden) sits behind a Cloudflare challenge since 2026 and
returns 403 to every non-browser client, which killed the Express / Netlify Functions proxy the app
depended on. The replacement, Radio Browser (api.radio-browser.info), is open, keyless, allows CORS
from any origin, and serves about 58k stations. Roughly a quarter of its streams are plain `http://`,
which browsers block as mixed content on an HTTPS page. Keeping those would require a stream proxy:
a serverless function with a 30 s timeout and bandwidth cost for every listener.

## Decision

- The catalogue is queried directly from the browser. There is no backend, no Netlify Function,
  no `/api/*` redirect. `netlify.toml` only describes the static build.
- The catalogue only returns stations whose stream is `https://` (`is_https=true` server-side and a
  client-side check in the adapter). Everything else is invisible to the UI.
- Provider knowledge lives in `src/catalogue/radioBrowser.js` only. Swapping or adding a provider
  means writing another adapter that satisfies `catalogue.contract.test.js`.

## Consequences

- Zero infrastructure and zero hosting cost beyond static files.
- Some popular stations are lost. In Spain, 6 of the 8 most voted stations stream over HTTP
  (Cadena SER, Cadena 100, Rock FM among them). If this becomes a problem, the fix is a stream-only
  proxy behind `catalogue.streamFor`, not a change to the UI.
- Favourites saved before this change carried a radio.garden URL and are discarded on load.
