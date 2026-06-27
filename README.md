# TypeBlitz

A real-time multiplayer typing race. Practice solo against a 20 WPM pace car, or
create a room and race up to 40 players on the same passage, with live progress
shown as cars on a track.

Live: https://typeblitz.ycydev.org

## Features

- **Solo mode** — practice against a fixed minimum-pace deadline; the clock
  starts on your first keystroke.
- **Multiplayer** — host a room (2–40 players), share an invite link, and start
  a synchronized match. Everyone counts down to the same server-anchored start
  and types the same passage.
- **Live race visualization** — each player is a car advancing along a track in
  real time.
- **Accurate scoring** — live WPM and accuracy, with a per-passage time limit
  derived from a 20 WPM floor.
- **Per-keystroke feedback** — the line shows the original text; correct
  characters are highlighted, mistakes are marked, and a popover reveals exactly
  what was mistyped.
- **Click-to-focus** — losing window focus pauses solo timing; a click resumes
  without penalty.
- **Audio** — Web Audio countdown, keystroke feedback, and a finish-line
  fanfare, all synthesized (no audio assets).
- **Bot protection** — room creation and joining are gated by Cloudflare
  Turnstile when configured.

## Architecture

A two-service monorepo deployed behind a single origin.

```
client/   Vue 3 single-page app (Vite, Tailwind CSS, TypeScript)
server/   Node.js Socket.IO + Express signalling/game server
```

In production the client is served by nginx, which also reverse-proxies
`/socket.io/` to the server over the internal network. Only the client port is
exposed; a Cloudflare Tunnel (cloudflared) can point at it directly.

```
browser  ->  cloudflared  ->  nginx (client :80)  ->  /socket.io/  ->  server :3001
```

## Tech stack

- **Client** — Vue 3 (`<script setup>`), TypeScript, Vite, Tailwind CSS,
  Vue Router, Socket.IO client.
- **Server** — Node.js, Express, Socket.IO, dotenv.
- **Infrastructure** — Docker (multi-stage, multi-arch images), nginx,
  GitHub Actions publishing to GitHub Container Registry (GHCR).

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+ (Vite requirement)
- npm

### Local development

Run the server and client in separate terminals.

```bash
# 1. Game server (http://localhost:3001)
cd server
npm install
npm start

# 2. Client (http://localhost:5173)
cd client
npm install
npm run dev
```

The Vite dev server proxies `/socket.io` to `localhost:3001`, so the client
connects same-origin during development. Turnstile verification is disabled when
no keys are configured, which is convenient for local work.

## Configuration

Environment variables (see the `.env.example` files):

| Variable | Scope | Description |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` | client (build time) | Cloudflare Turnstile public site key, embedded into the bundle. Leave empty to disable the widget. |
| `TURNSTILE_SECRET_KEY` | server | Turnstile secret used to verify tokens. Leave empty to disable verification (local only). |
| `QUOTE_COUNT` | server | Number of passages in `client/public/quotes.json`; the server picks a random index in `[0, QUOTE_COUNT)`. Defaults to 3000. |
| `PORT` | server | Server listen port (default 3001). |

Cloudflare provides always-pass dummy Turnstile keys for testing; see the
inline notes in `.env.example`.

## Deployment

The client and server are published as prebuilt multi-arch images
(`linux/amd64`, `linux/arm64`) by the GitHub Actions workflow:

- `ghcr.io/ycy-0510/typeblitz-client`
- `ghcr.io/ycy-0510/typeblitz-server`

Deploy with the production compose file, which pulls those images and exposes a
single port:

```bash
cp .env.example .env        # fill in TURNSTILE_SECRET_KEY
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Point a Cloudflare Tunnel (or any reverse proxy) at `http://localhost:8080`.
Because nginx proxies WebSocket traffic to the server internally, no other port
needs to be published.

To build the images locally instead of pulling them, use `docker-compose.yml`.

## Typing passages

Passages live in `client/public/quotes.json` (~3000 entries) and are fetched at
runtime rather than bundled, keeping the JavaScript bundle small. Each entry
records its text, source article, and a link.

The passages are excerpts from [Wikipedia](https://en.wikipedia.org/), used
under the [Creative Commons Attribution-ShareAlike 4.0 International
(CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/) licence. They
have been trimmed to single paragraphs and normalised to plain ASCII. Full
attribution and the complete list of source articles are available in-app at
`/quotes-credits.html`. The passage dataset is therefore likewise distributed
under CC BY-SA 4.0.

## Licence

- Typing passages (`quotes.json`): CC BY-SA 4.0, as described above.
- Application source code: © the project authors. See the repository for any
  accompanying `LICENSE` file.
