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

Crypto shows the top 100 coins by market cap automatically — CoinGecko
supports up to 250 per request, but at that size (with 7-day hourly
sparklines for every coin) the request was seen to intermittently fail
outright ("Failed to fetch") rather than error cleanly, so this dials
back to a lighter, more reliable payload. The main request also retries
once on that kind of network-level failure before giving up. The table
scrolls independently with a sticky header so a 100-row list doesn't
take over the page. Stocks come
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
crypto's top 100 by market cap, and its alert notification says so
explicitly. This is read-only awareness, not a recommendation to act on —
same disclaimer as everywhere else on this page.

The trend/accuracy logic lives in `signals.js`, shared by the page and by
`test.html`, which runs a handful of known-input/known-output checks and
shows pass/fail results in the browser — open it directly to run the
tests, no build step or test runner needed.

### Chart

A **Chart** section renders an interactive candlestick chart — drag to
pan, scroll/pinch to zoom, hover for exact OHLC values — via
[Lightweight Charts](https://www.tradingview.com/lightweight-charts/),
loaded from a CDN. This is the one external runtime dependency on an
otherwise fully self-contained page; if the CDN is blocked or
unreachable, the chart section shows a clear error instead of breaking
anything else. Crypto candles come from CoinGecko's OHLC endpoint (same
ticker-or-id handling as elsewhere, no key needed); stock candles reuse
Twelve Data's `time_series` endpoint (the same one behind stock
trend/accuracy), so they need that same optional key. The chart re-themes
automatically if you switch your OS between light and dark mode.

Crypto's 30-day OHLC data from CoinGecko is 4-hourly, not daily, so
candle times are plotted as exact Unix timestamps rather than
calendar-day strings — otherwise multiple same-day candles would collapse
into duplicate, non-ascending time values, which the charting library
rejects.

### News

A **News** section shows recent headlines, linked out to their original
source — crypto attempts to load via [CoinStats](https://coinstats.app/)
(no key needed), market news via the same Finnhub key used above. It's
headlines only: nothing is analyzed, scored, or treated as a trading
signal, and a "Refresh news" button re-fetches both lists on demand.
Article titles and links come from third-party APIs, so they're escaped
before being inserted into the page, and a link only renders if it
parses as a plain `http`/`https` URL — otherwise the headline shows as
plain text.

Crypto news specifically has been a rough spot: two earlier providers
(CryptoCompare, then Messari) both failed to load in-browser — one with
a confirmed CORS block, one with an unclear connection failure — before
landing on CoinStats as a third attempt, also unverified. Rather than
risk another dead end, any crypto-news fetch failure now falls back
automatically to a short message plus links to a few well-known crypto
news sites (CoinDesk, CoinTelegraph, The Block), so this section always
shows something useful even if the live feed never works from a
browser. Market news via Finnhub doesn't have this fallback, since it
hasn't shown the same failure pattern.

With live alerts enabled, a new headline in either feed also triggers a
browser notification — same change-detection idea as trend alerts: each
feed's first successful load just establishes a baseline silently, so
turning alerts on doesn't fire one notification per existing headline,
only for ones that show up afterward.

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

### Options (simulated)

Within the Paper Trading Simulator, an **Options** section lets you buy
simulated call and put contracts on any crypto or stock symbol the rest
of the page can price. Since there's no free options market data
anywhere (Finnhub, Twelve Data, and CoinGecko's free tiers all lack it),
premiums are computed with the standard
[Black-Scholes formula](https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model)
using the live underlying price, your chosen strike and days-to-expiry,
a fixed assumed volatility (70% for crypto, 35% for stocks), and a 0%
risk-free rate. **This is a simplified educational model, not real
market pricing** — a real options exchange would price the same contract
differently, reflecting actual supply, demand, and implied volatility.
One contract = one unit of the underlying here (not the standard
100-share equivalent), to keep the numbers easy to follow.

A "Close" button on each open position sells it back at its
current model price (or, past expiration, its exact intrinsic value —
the formula converges to that automatically as time-to-expiry hits
zero), crediting the proceeds to your simulated cash balance.

The pricing math (`blackScholesPrice`, plus the normal-distribution
helper it depends on) lives in `options.js`, tested in `test.html`
against known textbook reference values, put-call parity, and exact
intrinsic value at expiration.

## Getting started

1. Clone the repo: `git clone https://github.com/wbrownmooney-netizen/first-pr-practice.git`
2. Create a branch for your change: `git checkout -b my-change`
3. Make your edit, commit it, and push the branch
4. Open a pull request against `main`
