# ADR-0002: The player is a single HTMLAudioElement, without Web Audio, and skips HLS

Date: 2026-09-14
Status: accepted

## Context

The original app remounted `<audio key={url}>` for every station and shipped an unused Three.js
visualiser that hooked an `AnalyserNode` to the element. Two facts shaped the replacement:

1. Routing a media element through `AudioContext.createMediaElementSource` requires the stream to
   be same-origin or served with CORS headers. Almost no radio stream sends them, and the spec
   makes a tainted source produce silence. A Web Audio visualiser would mute most stations.
2. A plain `<audio>` element cannot play HLS (`.m3u8`) outside Safari. About 7.6 % of the HTTPS
   stations in Radio Browser are HLS.

## Decision

- `src/player/player.js` owns one `Audio` object for the whole session (never in the DOM, never
  recreated). Its status (`idle | connecting | playing | error`) is the only source of truth the
  UI reads. The element factory is injected so the state machine is unit-tested without a browser.
- No `AudioContext` anywhere. "Is it really playing?" is answered by the `playing` event and shown
  as the ON AIR indicator, not by a spectrum.
- The catalogue marks HLS streams as not playable and hides them, alongside `http://` streams.

## Consequences

- No "reload the page after five stations" workaround, and no leaked elements.
- Autoplay policy: `play()` runs after the user's click, possibly after a short fetch; browsers
  allow this within their activation window. If it is refused, the bar asks the user to press play.
- Bringing HLS back means an `hls.js` adapter inside the player (`play()` picks a strategy by
  stream type); the catalogue would then stop filtering `hls`. Neither the tuner nor the UI change.
- Bringing a visualiser back means a different signal source (e.g. server-side loudness metadata
  or a stream that sends CORS headers); it must not be `createMediaElementSource` on arbitrary streams.
