# first-pr-practice

A small practice repository for learning the GitHub pull request workflow.

## What this is

This repo exists so you can practice the full loop of making a change,
opening a pull request, and merging it — without any risk to a real project.

Licensed under [MIT](LICENSE).

## The app

`index.html` is a tiny standalone web app — a "PRs Shipped" counter that
saves its count in your browser's local storage. No build step or
dependencies required.

To run it, just open `index.html` in a browser, or serve the folder locally:

```
python -m http.server 8000
```

then visit `http://localhost:8000`.

### Installing as an app (PWA)

The site is an installable [Progressive Web App](https://web.dev/progressive-web-apps/):
open it in Chrome/Edge on desktop or Android and use the browser's
"Install" / "Add to Home Screen" option to get it as a standalone app
with its own icon, no address bar. `manifest.json` defines the app
metadata and icon; `sw.js` is a minimal service worker that caches only
this site's own static files (HTML/JS/manifest/icon) for basic offline
loading — it never touches CoinGecko, Finnhub, Twelve Data, news APIs,
or the charting CDN, so it can't ever serve stale live prices or
headlines. `icon.svg` is the original hand-drawn source icon; `icon-192.png`
and `icon-512.png` are real raster PNGs generated from it (a pure-Python
PNG encoder, hand-rasterizing the same candlestick shapes — no image
editor or library involved). This correction exists because the SVG-only
version turned out not to actually work: live-testing on desktop Chrome
showed the `beforeinstallprompt` event never fired despite the manifest,
icon, and service worker all technically passing validation — Chrome's
real install-eligibility check has an unwritten preference for a raster
icon that the spec itself doesn't require. The manifest now lists PNGs
first (both `any` and `maskable` purpose) with the SVG kept as a
fallback entry.

The icon design itself: a diagonal blue-to-violet gradient background
behind four ascending candlesticks, the tallest (rightmost) one in
accent green — an obvious "trending up" read even at small sizes,
versus the original's flat color and less clearly ordered candles. Since
there's still no image library available in this environment, the PNGs
are regenerated the same way as before (a small pure-Python rasterizer
using only stdlib `zlib`/`struct`, no PIL/cairosvg/Inkscape), just with
updated shapes and a hand-rolled diagonal gradient fill. Verified by
decoding the generated PNGs back in-browser via canvas and checking
specific pixel values (gradient interpolation, candle colors, and
transparent rounded corners) against the expected math, not just "a
valid PNG exists."

## Crypto & stocks dashboard

`trading.html` is a second standalone page: live crypto prices (via the
[CoinGecko](https://www.coingecko.com/en/api) public API, no key needed)
and stock quotes (via [Finnhub](https://finnhub.io/), which needs your own
free API key — paste it into the page and it's stored only in your
browser's local storage).

A sticky row of jump links at the top (Alerts, Movers, Crypto, Stocks,
Chart, News, Paper Trading) stays pinned while scrolling, since the page
has grown into quite a few sections.

Each row also shows a "next-step trend" of up/down/flat, computed as the
sign of a least-squares line fit over the recent price history, plus a
"historical accuracy" figure: how often that same signal matched the
actual next move when walked backward over recent price history. **This
is a naive statistics exercise, not investment advice** — a small sample
of past accuracy says nothing about future results, and the page does
not place any real trades.

Every accuracy figure is also labeled honestly against a coin-flip
baseline instead of showing the raw percentage alone — most small-sample
numbers on this page (e.g. "63% (8 tries)") are flagged as **"not
statistically different from a coin flip"** rather than left to look
like a real edge. `accuracySignificance()` in `signals.js` does this
with a rough one-sample z-test against 50% (standard error
`sqrt(0.25 / trials)`); results within about one standard error are
"not-significant," within two are a "weak" signal, and beyond that are
labeled "notable" (never "proven" — even a wide gap on a small, recent
sample isn't a guarantee). An expandable explainer in the "New here?"
section walks through why, with the actual math. This is a
simplification, not a textbook significance test, since backtest trials
come from overlapping windows on one price series and aren't fully
independent — it's meant to catch the common case honestly (small
numbers are noisy) rather than make a rigorous statistical claim.

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
take over the page. Every table on the page (this one included) scrolls
horizontally within its own container on narrow screens instead of
squeezing its columns into unreadable, wrapped cells — found and fixed
by actually testing the live site at a mobile viewport width, since a
few of the wider tables (Holdings, Options) were genuinely overflowing
their card before this. Stocks come
from a comma-separated watchlist — pre-filled with a default set of 20
well-known large-cap symbols across sectors so there's something to see
immediately, and freely editable to whatever you actually want to track.
(Neither Finnhub nor Twelve Data's free tiers offer a market-wide "top
movers" feed, so this default list stands in for a real screener —
combine it with the Trending up/down filters to see which of those
symbols are currently trending.) This was trimmed down to 5 for a while
to keep scans fast, then reverted back to 20: with a Twelve Data key set,
a full 20-symbol scan takes roughly 2-3 minutes (Twelve Data's free-tier
rate limit adds ~8s per symbol) — worth trimming the list yourself if
that's too slow, but broader coverage also means the Potential Movers
section below has more to actually search through.

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
down, or becomes a potential mover (see below). There's no backend
behind this page, so alerts only fire while the tab is open — closing it
stops them. Whatever triggered an alert also gets its row highlighted in
the table (a brief pulse, then a steady tint) for about two minutes, so
it's easy to spot which one changed.

A **Potential Movers** section pulls out anything currently near its
recent low (within 10% for crypto, 5% for stocks — arbitrary, disclosed
thresholds) *with* an upward trend signal at the same time — a naive
"possible bounce" heuristic layering two already-naive signals on top of
each other. Qualifying rows also get a **MOVER** badge and a persistent
amber tint in the main crypto/stock tables, and (with live alerts on)
a notification the moment a symbol first qualifies. This is explicitly
not a prediction that anything will actually reverse — most beaten-down
assets stay beaten down — and definitely not investment advice. Each
mover also shows its **historical accuracy** — the same backtested
figure as the Crypto/Stocks tables, i.e. how often that specific trend
signal has been right in the past, not a promise about what happens
next. Stock movers need a Twelve Data key (for price history), same as
stock trend/accuracy elsewhere on the page. The underlying `isNearLow`
check lives in `signals.js`, tested in `test.html` alongside the rest of
the signal logic.

**Price target alerts**, further down the same Alerts section, let you
watch a specific price for one symbol rather than just its trend. Add a
symbol and target price, and the next time this page polls (while live
alerts are on) it fires a one-shot notification the moment the price
crosses that target in either direction — then removes itself. Targets
are stored in `localStorage` and checked against the same live prices
the Crypto/Stocks tables already fetch, so there's no extra polling.

### Strategy comparison

A **Strategy comparison** section lets you run the naive trend signal
against two other naive strategies for one symbol at a time: a
**moving-average crossover** (`predictMACrossover` in `signals.js` —
the average of the most recent half of the window vs. the average of
the whole window) and **RSI** (`calculateRSI`/`predictRSI`, a plain
gain/loss average rather than Wilder's smoothing). RSI is read as a
**mean-reversion** signal — oversold (below 30) as a potential bounce
up, overbought (above 70) as a potential pullback down — deliberately
the opposite bet from the other two, which both follow momentum, so
it's normal and expected for them to disagree. All three are backtested
the same walk-forward way via a new `backtestPredictor(prices, window,
predictFn)` (a generalized version of `backtestSignal` that takes any
signal function, added rather than changing `backtestSignal` itself so
its existing tests and behavior stay untouched). Price history reuses
`fetchCryptoOhlc`/`fetchStockOhlc` — the same calls the Chart section
already makes — rather than adding a third way to fetch prices.

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

A **Realized P/L (all-time)** figure sits next to cash/portfolio value,
tracking actual locked-in profit or loss from every sell and closed
option, computed via `realizedGain(costBasis, exitPrice, quantity)` (also
in `portfolio.js`, also tested). It only counts what you've actually
sold — an open, unsold position's paper gains don't show up here until
you close it. Each sell/close in the Trade History table shows its own
realized P/L too. A **Total P/L (all-time)** figure sits next to it,
adding today's unrealized P/L across every open position and option
(`totalUnrealizedPL()` in `trading.html`) on top of that same realized
figure — the one number for "am I up or down overall," not just what's
been sold so far.

**Export/Import** buttons below the balance row save the whole paper
portfolio (cash, positions, options, history, realized P/L) as a JSON
file, or restore one from a previously exported file — a backup, or a
way to move a portfolio to another browser. Import asks for
confirmation first, since it replaces whatever's currently there, and
loosely validates the uploaded file's shape rather than trusting it
blindly.

Every buy also gets a **position-sizing note**: "(~6% of your
portfolio)" normally, or a highlighted "that's a large concentration in
one symbol" warning once a single position crosses 25% of total
portfolio value (`CONCENTRATION_WARN_PCT` in `trading.html`, an
arbitrary, disclosed line same as the near-low thresholds used
elsewhere). It's informational only — nothing here blocks the trade —
meant to build the habit of noticing concentration risk before it's a
problem, since nothing in a paper simulator naturally teaches that the
way a real, painful loss would.

An **Export/Import** control sits below the balance row: Export
downloads your current cash, holdings, options, and trade history as a
timestamped JSON file (a plain client-side `Blob`/anchor-download, no
server involved); Import reads a previously exported file back in,
after a loose shape check (`isValidPaperState()`) and a confirmation
prompt, since it fully replaces whatever paper portfolio is currently
saved in this browser. Meant as a backup, or a way to move a paper
portfolio to a different browser or machine — it's still just
`localStorage` under the hood, same as the rest of this simulator.

A **Trading patterns** panel below the trade history mines your own
closed trades for a well-documented behavioral-finance tendency: the
**disposition effect**, the instinct to sell winners quickly but hold
losers hoping they recover. `holdingTimeBias()` (in `portfolio.js`,
tested) compares the average holding time of winning vs. losing closed
trades — spot or option — and needs at least 3 of each before it says
anything, so a couple of trades can't be read as a "pattern." The
wording adapts to whatever the data actually shows (the effect, its
opposite, or no strong pattern either way) rather than assuming
everyone exhibits the classic version. This is the first feature on the
page that reflects the user's *own* behavior back at them instead of
explaining a static concept — holding time is measured from when a
position was first opened (not per-lot, since this simulator uses
weighted-average cost rather than FIFO/LIFO lots), and it never claims
holding longer or shorter was actually the *right* call in any specific
trade, only that a pattern exists.

### Options (simulated)

An expandable **"New to options? Calls vs. puts, explained"** panel sits
above the order form, walking through what a call/put actually is, what
premium/strike/expiration mean, why an option's max loss (as a buyer) is
capped at the premium paid, and a worked numeric example — aimed at
someone who's never traded an option before placing their first
simulated one. A **"Quick self-check"** quiz at the end of that panel
closes the loop with three low-stakes multiple-choice questions (max
loss as a buyer, which direction a put gains value, why more time to
expiry means more value) — no scoring, no persistence, answers can be
retried freely, and every choice (right or wrong) gets its own
explanation rather than a generic "wrong" message, since a common wrong
answer usually reveals a specific misconception worth addressing
directly.

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

Each open position has a **"Why did this change?"** expandable section —
an educational breakdown of *why* its value moved, not just by how much.
Since this simulator holds volatility fixed per asset class, only two
things actually change between opening a position and now: the
underlying price, and the time remaining. `decomposeOptionChange()` (also
in `options.js`, also tested) splits the value change into a time-decay
component (what if only time had passed) and a price-move component
(what if only the price had changed) — plus an honestly-labeled
"interaction" leftover, since option value isn't linear in either
variable and the two components rarely sum exactly to the real change.
This is meant to build intuition for how options pricing actually works,
not to hide the model's rough edges behind a falsely-clean explanation.
The time-decay and price-move lines are also labeled with the real
industry terms for them ("theta" and "delta"), and the calls/puts
education panel above the order form previews those names before you
ever open a position, so the jargon on a live breakdown isn't the first
time you've seen it.

## Glossary

A **Glossary** section at the bottom of `trading.html` (also in the
sticky jump-nav) collects every term introduced piecemeal elsewhere on
the page — grouped into Options, Portfolio & risk, and Signals &
statistics, each alphabetical within its group — for anyone who lands
partway down the page without having opened every education panel in
order. It's pure static content: no new logic, just consolidation, kept
consistent with how each term is actually defined and used elsewhere on
the page rather than introducing a second, slightly-different
explanation.

## Getting started

1. Clone the repo: `git clone https://github.com/wbrownmooney-netizen/first-pr-practice.git`
2. Create a branch for your change: `git checkout -b my-change`
3. Make your edit, commit it, and push the branch
4. Open a pull request against `main`
