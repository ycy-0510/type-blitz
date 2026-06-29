// Release knobs for the client.
//
// BUILD — auto-generated at build time (NOT edited by hand). The build id is
// computed from git in vite.config.ts and injected as VITE_BUILD; in CI the same
// value is passed to both the client and server images as a build-arg so they
// always agree. Format: YYMMDD.NN (NN = commits on that day). Shown in the footer
// and on the "What's New" billboard purely for diagnostics.
export const BUILD = (import.meta.env.VITE_BUILD as string | undefined) || 'dev'

// WHATS_NEW_REV — the ONLY thing that controls whether the "What's New" billboard
// reappears. Bump this by hand whenever you change the highlights in
// components/WhatsNew.vue. It is deliberately independent of BUILD: BUILD changes
// on every deploy, but the billboard should only pop up when there is genuinely
// something new to announce. Once a user dismisses a given revision it stays
// hidden until this value changes again. Use today's date; add a `.N` suffix if
// you bump more than once on the same day (e.g. '2026-06-30.2').
export const WHATS_NEW_REV = '2026-06-30.2'
