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

Both tables have **Trending up** / **Trending down** filter buttons, so you
can see at a glance which coins or watchlist stocks the signal currently
favors in either direction — still just a filtered view of the same data,
not a recommendation.

Crypto shows the top 20 coins by market cap automatically. Stocks are
scanned from a comma-separated watchlist you type in (e.g. `AAPL, TSLA,
MSFT`), fetched in parallel; if a symbol fails (bad ticker, rate limit,
etc.) the rest still load and the failure is reported separately.

Open it directly, or click through from `index.html`.

The trend/accuracy logic lives in `signals.js`, shared by the page and by
`test.html`, which runs a handful of known-input/known-output checks and
shows pass/fail results in the browser — open it directly to run the
tests, no build step or test runner needed.

## Getting started

1. Clone the repo: `git clone https://github.com/wbrownmooney-netizen/first-pr-practice.git`
2. Create a branch for your change: `git checkout -b my-change`
3. Make your edit, commit it, and push the branch
4. Open a pull request against `main`
