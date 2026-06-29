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
        // A passage must never start with punctuation/whitespace, otherwise the
        // very first thing you'd have to type is a stray symbol (e.g. a leading
        // quote mark, dash, or bracket). Drop any leading non-alphanumeric run so
        // typing always begins on a real word. Texts are normalised to ASCII.
        const cleaned = data.map((q) => ({
          ...q,
          text: q.text.replace(/^[^A-Za-z0-9]+/, ''),
        }))
        quotes.splice(0, quotes.length, ...cleaned)
      })
      .catch((err) => {
        console.error('Failed to load quotes.json', err)
      })
  }
  return loading
}
