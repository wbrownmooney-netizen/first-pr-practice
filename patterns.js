// Naive candlestick pattern detection over OHLC candles ({open, high,
// low, close}). These are textbook shape definitions, not a trading
// signal — they describe what a candle (or short run of candles) looks
// like, not what happens next. backtestPatternAccuracy (below) measures
// how often each shape's conventional direction actually panned out,
// same spirit as the trend/MA/RSI backtests in signals.js — worth
// checking before treating any of these as more than a descriptive
// label.

function candleStats(c) {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  return { body, range, upperWick, lowerWick, bullish: c.close > c.open, bearish: c.close < c.open };
}

// Body under 10% of the full range — open and close sit close together,
// conventionally read as indecision. Arbitrary, disclosed threshold,
// same spirit as the near-low/concentration thresholds elsewhere.
function isDoji(c) {
  const { body, range } = candleStats(c);
  if (range <= 0) return false;
  return body / range <= 0.1;
}

// Small body sitting near the top of the range, a lower shadow at least
// twice the body, and little/no upper shadow — conventionally a
// bullish-reversal shape (context, like a preceding downtrend, isn't
// checked here — same "naive" spirit as the rest of this page).
function isHammer(c) {
  const { body, upperWick, lowerWick, range } = candleStats(c);
  if (range <= 0 || body <= 0) return false;
  return lowerWick >= body * 2 && upperWick <= body * 0.5;
}

// Mirror of isHammer: small body near the bottom, a long upper shadow,
// little/no lower shadow — conventionally bearish-reversal.
function isShootingStar(c) {
  const { body, upperWick, lowerWick, range } = candleStats(c);
  if (range <= 0 || body <= 0) return false;
  return upperWick >= body * 2 && lowerWick <= body * 0.5;
}

// A bearish candle followed by a bullish candle whose body fully
// contains the prior candle's body.
function isBullishEngulfing(prev, curr) {
  const p = candleStats(prev), c = candleStats(curr);
  return p.bearish && c.bullish && curr.open <= prev.close && curr.close >= prev.open;
}

// Mirror of isBullishEngulfing: bullish candle then a bearish candle
// whose body fully contains it.
function isBearishEngulfing(prev, curr) {
  const p = candleStats(prev), c = candleStats(curr);
  return p.bullish && c.bearish && curr.open >= prev.close && curr.close <= prev.open;
}

// Three-candle reversal: a sizeable bearish candle, a small-bodied
// candle that gaps below it, then a bullish candle closing back above
// the midpoint of the first candle's body.
function isMorningStar(first, middle, last) {
  const f = candleStats(first), m = candleStats(middle);
  if (!f.bearish || f.body <= 0 || !candleStats(last).bullish) return false;
  const smallMiddle = m.body <= f.body * 0.5;
  const middleBelowFirst = Math.max(middle.open, middle.close) <= first.close;
  const closesIntoFirst = last.close > (first.open + first.close) / 2;
  return smallMiddle && middleBelowFirst && closesIntoFirst;
}

// Mirror of isMorningStar: sizeable bullish candle, a small-bodied
// candle gapping above it, then a bearish candle closing back below the
// first candle's body midpoint.
function isEveningStar(first, middle, last) {
  const f = candleStats(first), m = candleStats(middle);
  if (!f.bullish || f.body <= 0 || !candleStats(last).bearish) return false;
  const smallMiddle = m.body <= f.body * 0.5;
  const middleAboveFirst = Math.min(middle.open, middle.close) >= first.close;
  const closesIntoFirst = last.close < (first.open + first.close) / 2;
  return smallMiddle && middleAboveFirst && closesIntoFirst;
}

// Scans a full candle series and returns one match per candle at most —
// checked in priority order (3-candle patterns, then 2-candle, then
// single-candle; Hammer/Shooting Star before Doji) so a candle that
// happens to satisfy more than one shape isn't reported twice.
function detectPatterns(candles) {
  const results = [];
  for (let i = 0; i < candles.length; i++) {
    if (i >= 2) {
      if (isMorningStar(candles[i - 2], candles[i - 1], candles[i])) {
        results.push({ index: i, pattern: 'Morning Star', direction: 'bullish' });
        continue;
      }
      if (isEveningStar(candles[i - 2], candles[i - 1], candles[i])) {
        results.push({ index: i, pattern: 'Evening Star', direction: 'bearish' });
        continue;
      }
    }
    if (i >= 1) {
      if (isBullishEngulfing(candles[i - 1], candles[i])) {
        results.push({ index: i, pattern: 'Bullish Engulfing', direction: 'bullish' });
        continue;
      }
      if (isBearishEngulfing(candles[i - 1], candles[i])) {
        results.push({ index: i, pattern: 'Bearish Engulfing', direction: 'bearish' });
        continue;
      }
    }
    if (isHammer(candles[i])) {
      results.push({ index: i, pattern: 'Hammer', direction: 'bullish' });
      continue;
    }
    if (isShootingStar(candles[i])) {
      results.push({ index: i, pattern: 'Shooting Star', direction: 'bearish' });
      continue;
    }
    if (isDoji(candles[i])) {
      results.push({ index: i, pattern: 'Doji', direction: 'neutral' });
    }
  }
  return results;
}

// Measures how often a given pattern type was historically followed by
// a move matching its conventional direction, `lookahead` candles later
// — same backtesting approach as backtestSignal in signals.js (walk
// history, compare a prediction against what actually happened),
// applied to candlestick shapes instead of the trend signal. A pattern
// occurrence within `lookahead` candles of the end of the series can't
// be scored yet (no "after" to check) and is excluded rather than
// guessed at. Doji has no directional bias (`direction: 'neutral'`) so
// there's nothing to test — always returns null for it. Returns null
// (not 0 trials) when nothing was scorable, same convention as
// backtestSignal, so callers can render "not enough data" consistently.
function backtestPatternAccuracy(candles, patternName, lookahead) {
  const matches = detectPatterns(candles).filter(m => m.pattern === patternName && m.direction !== 'neutral');
  if (matches.length === 0) return null;
  let correct = 0, trials = 0;
  for (const m of matches) {
    const exitIndex = m.index + lookahead;
    if (exitIndex >= candles.length) continue;
    trials++;
    const movedUp = candles[exitIndex].close > candles[m.index].close;
    const matched = m.direction === 'bullish' ? movedUp : !movedUp;
    if (matched) correct++;
  }
  return trials > 0 ? { accuracy: correct / trials, trials } : null;
}
