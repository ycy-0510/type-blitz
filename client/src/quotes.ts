// Typing passages are excerpts from Wikipedia, used under CC BY-SA 4.0 (modified:
// trimmed to single paragraphs and normalised to plain ASCII). See the full
// attribution and source-article list at /quotes-credits.html.
//
// There are ~3000 of them, so they live in /public/quotes.json and are fetched
// at runtime (kept out of the JS bundle) and loaded before the app mounts
// (see main.ts). Components keep importing `quotes` and using it synchronously.

export interface Quote {
  text: string
  source: string
  url?: string
}

export const quotes: Quote[] = []

let loading: Promise<void> | null = null

export function loadQuotes(): Promise<void> {
  if (!loading) {
    loading = fetch('/quotes.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Quote[]) => {
        quotes.splice(0, quotes.length, ...data)
      })
      .catch((err) => {
        console.error('Failed to load quotes.json', err)
      })
  }
  return loading
}
