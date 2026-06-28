// Derived statistics for the dashboard home page. All inputs come from the
// locally-stored match history (see store.ts). 0-WPM runs are already filtered
// out of history, but we defensively guard against them here too.

import type { MatchRecord } from './store'

export interface MetricStats {
  avg: number
  top5: number // average of the best 5% of runs (an "elite band")
  top: number // single best run
  count: number
}

export interface GrowthRow {
  days: number
  // Percentage change of the recent window vs the window immediately before it.
  // null when there isn't enough data on either side to be meaningful.
  pct: number | null
}

const DAY_MS = 86_400_000

function mean(xs: number[]): number {
  if (!xs.length) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// avg / top-5%-band / best for a list of metric values (WPM or accuracy).
export function metricStats(values: number[]): MetricStats {
  const xs = values.filter((v) => typeof v === 'number' && v > 0)
  if (!xs.length) return { avg: 0, top5: 0, top: 0, count: 0 }
  const desc = [...xs].sort((a, b) => b - a)
  const n = Math.max(1, Math.ceil(desc.length * 0.05))
  return {
    avg: mean(xs),
    top5: mean(desc.slice(0, n)),
    top: desc[0],
    count: xs.length,
  }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Consecutive-day streak ending today (or yesterday, so a streak isn't "lost"
// until a full day with no play passes). Also returns total distinct days.
export function dayStreak(records: MatchRecord[]): { current: number; activeDays: number } {
  if (!records.length) return { current: 0, activeDays: 0 }
  const days = new Set(records.map((r) => dayKey(new Date(r.date))))

  let cursor = new Date()
  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS) // allow streak to count from yesterday
    if (!days.has(dayKey(cursor))) return { current: 0, activeDays: days.size }
  }

  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return { current: streak, activeDays: days.size }
}

// "Stable & Grow": for each time window, compare the WPM of the recent window
// against the window immediately before it. Median is used so a single bad run
// (a misfire, an interrupted race) doesn't swing the trend.
export function wpmGrowth(records: MatchRecord[], windows: number[] = [5, 14, 30, 90]): GrowthRow[] {
  const now = Date.now()
  const at = (r: MatchRecord) => new Date(r.date).getTime()
  return windows.map((days) => {
    const span = days * DAY_MS
    const recent = records.filter((r) => at(r) > now - span && r.wpm > 0).map((r) => r.wpm)
    const prev = records
      .filter((r) => at(r) <= now - span && at(r) > now - 2 * span && r.wpm > 0)
      .map((r) => r.wpm)
    // Need at least 2 samples on each side, otherwise the comparison is noise.
    if (recent.length < 2 || prev.length < 2) return { days, pct: null }
    const base = median(prev)
    if (base <= 0) return { days, pct: null }
    return { days, pct: ((median(recent) - base) / base) * 100 }
  })
}
