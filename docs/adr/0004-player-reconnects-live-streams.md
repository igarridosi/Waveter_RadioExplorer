# ADR-0004: The player reconnects a live stream on its own

Date: 2026-09-18
Status: accepted

## Context

Listeners reported stations that start, then fall silent after seconds or minutes, with a page
reload as the only way back. Measured on "Your Classical - Relax" (Minnesota Public Radio,
http, relayed): the upstream streamed for 75 s and the relay for 120 s without a hiccup, so the
transport looked innocent at first. The actual cause turned out to be in the relay after all
(the origin dropping a client whose reads paused; see the amendment to ADR-0003), but the
reconnect policy below stays: it does not need a specific cause to be worth having: a live stream is a connection
that will eventually break somewhere (an Icecast server dropping a slow reader, a network blip,
a phone changing networks, a laptop waking up), and a browser media element never reconnects by
itself. The player only listened to `playing`, `waiting` and `error`; a dead stream left the bar
on "ON AIR" forever.

## Decision

`src/player/player.js` keeps the listener's intent ("I want this station") separate from what
the element is doing, and reconnects while the intent stands:

- Triggers: `ended`, `error`, a rejected `play()` (other than autoplay refusal), and a
  progress watchdog: no `timeupdate` for `STALL_MS` (8 s), checked every `WATCHDOG_MS` (2 s).
- Not triggers: `stalled` and `waiting` on their own. Chrome fires them while there is still
  buffer to play; acting on them would cut audio that was going to continue. They only flip the
  status to "connecting" so the bar tells the truth.
- Backoff 1, 2, 4, 8, 16, 30 s, then `MAX_RECONNECTS` (6) is reached and the bar shows
  "not responding" with a retry button. A successful `playing` resets the backoff. A `window`
  `online` event skips the remaining wait.
- A `pause` the player did not issue (lock-screen controls, unplugged headphones) becomes the
  `paused` status; the bar shows a play button and `resume()` reconnects rather than playing
  stale buffer. A `pause` within 1 s of connecting is browser churn and is ignored.
- Clock and timers are injected so the whole policy is unit-tested with a fake clock
  (`player.test.js`, "keeping a live stream alive"). In development the player is exposed as
  `window.__waveterPlayer` (with `.element`) so a drop can be simulated from the console:
  `__waveterPlayer.element.dispatchEvent(new Event('error'))`.

## Consequences

- No more reloads to get audio back; a drop costs the backoff delay plus connection time.
- Reconnecting a live stream restarts it from "now"; there is no gapless resume for radio.
- A stream that keeps playing silence cannot be detected (time still advances); that is the
  station's problem, not a drop.
