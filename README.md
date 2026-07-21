# first-pr-practice

A small practice repository for learning the GitHub pull request workflow.

## What this is

This repo exists so you can practice the full loop of making a change,
opening a pull request, and merging it — without any risk to a real project.

## The app

`index.html` is a tiny standalone web app — a "PRs Shipped" counter that
saves its count in your browser's local storage. No build step or
dependencies required.

To run it, just open `index.html` in a browser, or serve the folder locally:

```
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Crypto & stocks dashboard

`trading.html` is a second standalone page: live crypto prices (via the
[CoinGecko](https://www.coingecko.com/en/api) public API, no key needed)
and stock quotes (via [Finnhub](https://finnhub.io/), which needs your own
free API key — paste it into the page and it's stored only in your
browser's local storage).

Each row also shows a "next-step trend" of up/down/flat, computed as the
sign of a least-squares line fit over the recent price history, plus a
"historical accuracy" figure: how often that same signal matched the
actual next move when walked backward over recent price history. **This
is a naive statistics exercise, not investment advice** — a small sample
of past accuracy says nothing about future results, and the page does
not place any real trades.

**Stock trend/accuracy need a second, optional key.** Finnhub's free
tier returns a 403 for historical stock candle data (a paid-plan feature
there), so that data instead comes from
[Twelve Data](https://twelvedata.com/), whose free tier does include
daily history. Paste a free Twelve Data key into the second stock field
to enable it; without one, stock rows just show "add Twelve Data key" in
those columns while price and 24h change keep working via Finnhub.
Crypto's trend/accuracy work regardless, since CoinGecko's sparkline data
has no such restriction.

Crypto shows the top 250 coins by market cap automatically — CoinGecko's
maximum per request, and comfortably more than the vast majority of
coins anyone would ask about, though still "top 250 by market cap," not
literally every coin that exists. The table scrolls independently with a
sticky header so a 250-row list doesn't take over the page. Stocks come
from a comma-separated watchlist — pre-filled with a default set of 5
well-known large-cap symbols so there's something to see immediately, and
freely editable to whatever you actually want to track. (Neither Finnhub
nor Twelve Data's free tiers offer a market-wide "top movers" feed, so
this default list stands in for a real screener — combine it with the
Trending up/down filters to see which of those symbols are currently
trending.)

Stock requests are deliberately throttled: symbols are fetched **one at a
time** (not all at once), each symbol's quote and history requests go out
**sequentially** rather than in parallel, and a request that comes back
`429` (rate limited) is retried once after a short backoff before being
reported as failed. A second scan can't start while one is already in
flight. The gap between symbols widens automatically (500ms → 8s) when a
Twelve Data key is set, since its free tier's per-minute limit is much
tighter than Finnhub's. Rows appear as each symbol comes back, so a full
watchlist doesn't feel like a stall; if a symbol still fails after the
retry, the rest keep loading and the failure is reported separately.

The history request asks Twelve Data for 90 days of daily closes
(`interval=1day&outputsize=90`), giving comfortably more data than the
backtest's 5-day window needs.

Open it directly, or click through from `index.html`.

An **"Enable live alerts"** button turns on browser notifications: while
the tab stays open, the page re-polls every 60 seconds and fires a
notification whenever a coin or watchlist stock's trend flips to up or
down. There's no backend behind this page, so alerts only fire while the
tab is open — closing it stops them. Whatever triggered an alert also
gets its row highlighted in the table (a brief pulse, then a steady
tint) for about two minutes, so it's easy to spot which one changed.

The dashboard is aware of your [paper trading](#paper-trading-simulator)
holdings (read from the same browser's localStorage — no extra setup):
anything you currently hold gets a **HELD** badge next to its name, is
automatically added to the stock watchlist and fetched even if outside
crypto's top 250 by market cap, and its alert notification says so
explicitly. This is read-only awareness, not a recommendation to act on —
same disclaimer as everywhere else on this page.

The trend/accuracy logic lives in `signals.js`, shared by the page and by
`test.html`, which runs a handful of known-input/known-output checks and
shows pass/fail results in the browser — open it directly to run the
tests, no build step or test runner needed.

## Paper trading simulator

The **Paper Trading Simulator** is a section further down `trading.html`
(jump to it via the "Paper trading simulator" link in the header) — a
broker-free, fake-money trading simulator living on the same page as the
dashboard, rather than a separate file. It starts you with $10,000 in
simulated cash and lets you "buy" and "sell" crypto or stocks at real
live prices (crypto via CoinGecko, stocks via the same Finnhub key used
above), tracking your simulated holdings, cost basis, and unrealized
profit or loss. Everything is stored locally in your browser — **no real
broker, no real money, ever.**

Crypto trades accept [CoinGecko IDs](https://www.coingecko.com/en/all-cryptocurrencies)
(e.g. `bitcoin`) or common tickers (e.g. `btc`) — a ticker that isn't
itself a valid CoinGecko id is automatically resolved via CoinGecko's
search API (first exact symbol match, cached in memory so it isn't
re-looked-up on every price refresh); stock trades reuse the same
Finnhub API key field from the Stocks section above it. A "Reset" button clears your
simulated portfolio back to $10,000 whenever you want a clean start.

This exists instead of a real broker connection: we deliberately don't
place real trades or handle real account credentials — see the trade
history and holdings table for a realistic feel without any of the risk.

The cost-basis math (`buyPosition`/`sellPosition`) lives in `portfolio.js`,
shared by the page and by `test.html`, which now also covers it: opening a
position, weighted-average cost across uneven buy sizes, partial sells,
and selling more than you hold (which should fail).

## Getting started

1. Clone the repo: `git clone https://github.com/wbrownmooney-netizen/first-pr-practice.git`
2. Create a branch for your change: `git checkout -b my-change`
3. Make your edit, commit it, and push the branch
4. Open a pull request against `main`
