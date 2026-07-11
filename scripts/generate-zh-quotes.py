#!/usr/bin/env python3
"""Generate the Traditional Chinese (Taiwan) typing corpus.

Fetches random article intros from Chinese Wikipedia with the zh-tw language
variant, splits them into sentence-aligned passages, and keeps only passages
whose every character is:

  - one of the 4808 MOE (教育部) common characters (common-chinese-chars.txt), or
  - an ASCII digit, or
  - an allowed punctuation mark (see ALLOWED_PUNCT)

so nothing rare/untypeable ever appears in a race. Outputs:

  client/public/quotes-zh.json          — [{text, source, url}]
  client/public/quotes-zh-credits.html  — CC BY-SA attribution page

Usage:  python3 scripts/generate-zh-quotes.py [target_count]

Note for the server: room quote indexes for Chinese are picked from
QUOTE_COUNT_ZH (server/index.js), which must match the number of passages in
quotes-zh.json.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WHITELIST = set((Path(__file__).parent / 'common-chinese-chars.txt').read_text(encoding='utf-8'))
DIGITS = set('0123456789')
# Small, IME-typeable punctuation set. Comparison in the client normalises
# full/half width, so players may type either form.
ALLOWED_PUNCT = set('，。、！？；：「」．·％%')
SENT_END = '。！？'

MIN_LEN, MAX_LEN = 60, 120
MIN_CJK_RATIO = 0.85          # passages should be mostly Chinese, not digit soup
MAX_PER_ARTICLE = 2

API = 'https://zh.wikipedia.org/w/api.php'
HEADERS = {'User-Agent': 'TypeBlitz-corpus/1.0 (typing game; contact: maxchuang1234@gmail.com)'}

# Full-width digits → ASCII
FW_DIGITS = str.maketrans('０１２３４５６７８９', '0123456789')


def fetch_batch():
    """One API call: 20 random main-namespace article intros, zh-tw variant."""
    params = {
        'action': 'query',
        'format': 'json',
        'formatversion': '2',
        'generator': 'random',
        'grnnamespace': '0',
        'grnlimit': '20',
        'prop': 'extracts|info',
        'exintro': '1',
        'explaintext': '1',
        'exlimit': '20',
        'inprop': 'url|varianttitles',
        'variant': 'zh-tw',
        'redirects': '1',
    }
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    return data.get('query', {}).get('pages', [])


def clean_extract(text: str) -> str:
    text = text.translate(FW_DIGITS)
    # Drop parenthesised asides (they carry most of the Latin/birth-date noise):
    # innermost-first so nested parens unwind.
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r'（[^（）]*）', '', text)
        text = re.sub(r'\([^()]*\)', '', text)
    text = re.sub(r'\s+', '', text)  # Chinese prose needs no spaces
    return text


def split_sentences(text: str):
    return [s for s in re.findall(r'[^。！？]*[。！？]', text) if s]


def acceptable(passage: str) -> bool:
    if not (MIN_LEN <= len(passage) <= MAX_LEN):
        return False
    if passage[0] not in WHITELIST:  # must open on a real character
        return False
    cjk = 0
    for ch in passage:
        if ch in WHITELIST:
            cjk += 1
        elif ch not in DIGITS and ch not in ALLOWED_PUNCT:
            return False
    return cjk / len(passage) >= MIN_CJK_RATIO


def passages_from(text: str):
    """Greedily pack whole sentences into MIN..MAX length passages."""
    out, buf = [], ''
    for s in split_sentences(text):
        if len(buf) + len(s) <= MAX_LEN:
            buf += s
        else:
            if acceptable(buf):
                out.append(buf)
            buf = s if len(s) <= MAX_LEN else ''
    if acceptable(buf):
        out.append(buf)
    return out


def main(target: int):
    quotes, seen_text, per_article = [], set(), {}
    batches = 0
    while len(quotes) < target and batches < 600:
        try:
            pages = fetch_batch()
        except Exception as e:
            print(f'  batch error: {e}; retrying in 3s', file=sys.stderr)
            time.sleep(3)
            continue
        batches += 1
        for page in pages:
            # Prefer the zh-tw display title (article titles are stored in
            # whichever variant they were created in).
            title = page.get('varianttitles', {}).get('zh-tw') or page.get('title', '')
            extract = page.get('extract') or ''
            url = page.get('fullurl') or f'https://zh.wikipedia.org/wiki/{urllib.parse.quote(title)}'
            if not extract:
                continue
            for p in passages_from(clean_extract(extract)):
                if p in seen_text or per_article.get(title, 0) >= MAX_PER_ARTICLE:
                    continue
                seen_text.add(p)
                per_article[title] = per_article.get(title, 0) + 1
                quotes.append({'text': p, 'source': f'維基百科：{title}', 'url': url})
        if batches % 10 == 0:
            print(f'  {batches} batches → {len(quotes)} passages')
        time.sleep(0.3)

    quotes = quotes[:target]
    out = ROOT / 'client/public/quotes-zh.json'
    with out.open('w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(
            json.dumps(q, ensure_ascii=False) for q in quotes) + '\n]\n')
    print(f'Wrote {len(quotes)} passages to {out}')

    write_credits(quotes)


def write_credits(quotes):
    articles = sorted({(q['source'].removeprefix('維基百科：'), q['url']) for q in quotes})
    lis = '\n'.join(
        f'<li><a href="{escape(u, quote=True)}">{escape(t)}</a></li>' for t, u in articles)
    today = time.strftime('%Y-%m-%d')
    html = f"""<!doctype html>
<html lang="zh-Hant-TW"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TypeBlitz — 中文文章來源與授權</title>
<style>
  body{{background:#272822;color:#f8f8f2;font-family:ui-monospace,Menlo,Consolas,monospace;
       max-width:900px;margin:0 auto;padding:2rem 1.25rem;line-height:1.6}}
  h1{{color:#a6e22e}} a{{color:#66d9ef}} code{{color:#fd971f}}
  .note{{background:#1e1e1e;border:1px solid #3c3c37;border-radius:.75rem;padding:1rem 1.25rem}}
  ul{{columns:2;-webkit-columns:2;font-size:.85rem;padding-left:1.2rem}}
  @media(max-width:640px){{ul{{columns:1}}}}
  li{{break-inside:avoid;margin:.15rem 0}}
</style></head><body>
<h1>中文文章來源與授權</h1>
<div class="note">
<p>TypeBlitz 的中文打字文章節錄自<a href="https://zh.wikipedia.org/">維基百科</a>（臺灣正體變體），
依 <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant">創用 CC 姓名標示－相同方式分享 4.0（CC BY-SA 4.0）</a>授權使用。</p>
<p><strong>修改說明：</strong>文章節錄為單一段落、移除括號註解，並僅保留教育部 4808 個常用字、
數字與常見標點。原始條目在節錄後（{today}）可能已有變動。</p>
<p>本文章資料集（<code>quotes-zh.json</code>）同樣以
<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant">CC BY-SA 4.0</a> 釋出。
每篇文章都在遊戲內與下方標註出處。TypeBlitz 程式本身另行授權。</p>
</div>
<h2>來源條目（{len(articles)}）</h2>
<ul>
{lis}
</ul>
</body></html>
"""
    out = ROOT / 'client/public/quotes-zh-credits.html'
    out.write_text(html, encoding='utf-8')
    print(f'Used {len(articles)} Wikipedia articles')
    print(f'Wrote credits page to {out}')


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 600)
