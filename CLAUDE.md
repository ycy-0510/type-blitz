# TypeBlitz

Real-time multiplayer typing race. Two-service monorepo:

- `client/` — Vue 3 (`<script setup>`) + TypeScript + Vite + Tailwind, Socket.IO client.
- `server/` — Node.js + Express + Socket.IO signalling/game server.

See `README.md` for architecture, deployment, and configuration.

## Versioning & "What's New"

There are two **separate** version concepts — keep them distinct:

- **`BUILD` (auto, diagnostics only)** — format `YYMMDD.NN` (`NN` = commits on that
  day). Derived from git in `client/vite.config.ts` and `server/index.js`; CI
  injects the same value into both images via build-args. **Never edit by hand** —
  it changes on every commit/deploy. Shown in the footer and on the billboard.
- **`WHATS_NEW_REV` (manual)** — in `client/src/version.ts`. This and only this
  controls whether the "What's New" billboard reappears. Dismissing it stores this
  value in `localStorage`; it reappears only when this value changes.

The billboard content lives in `client/src/components/WhatsNew.vue` (`highlights`).

## Release workflow (follow this every task)

1. **Before starting work**, run `git status`. If there are uncommitted changes
   from a previous task, surface them and get them committed first — don't pile new
   work on top of an unfinished change.
2. **If the working tree is clean** when you start (the previous release has been
   committed/shipped, i.e. a new cycle is beginning), **clear the old What's New**:
   reset the `highlights` array in `WhatsNew.vue` so the board reflects only the
   changes from this new cycle.
3. **After finishing the work**, **maintain What's New**: add the changes you just
   made to the `highlights` (US-sign ALL CAPS, short), and bump `WHATS_NEW_REV` in
   `version.ts` (use today's date, e.g. `'2026-07-01'`) so the billboard re-shows.

Do **not** touch `BUILD` — it is generated automatically.
