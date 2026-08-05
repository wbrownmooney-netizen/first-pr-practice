// Naive trend prediction: fit a line (least squares) over recent prices
// and report the sign of its slope. Not a real forecasting model.
function predictTrend(prices) {
  const n = prices.length;
  if (n < 2) return null;
  const xs = prices.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = prices.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (prices[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const relative = slope / (meanY || 1);
  if (relative > 0.001) return 'up';
  if (relative < -0.001) return 'down';
  return 'flat';
}

// Walks an arbitrary signal function forward through history: at each
// point, predict the next step from the preceding `window` prices
// (a plain array, same shape predictTrend takes), then check whether
// that prediction matched what actually happened next. This is a
// backtest over a small recent sample, not a guarantee of future
// performance. Generalized so the same walk-forward logic can score
// predictTrend, predictTrendMA, predictTrendRSI, or any other
// (prices) -> 'up'|'down'|'flat'|null signal the same way.
function backtestSignalWith(predictFn, prices, window) {
  let correct = 0, trials = 0;
  for (let i = window; i < prices.length - 1; i++) {
    const predicted = predictFn(prices.slice(i - window, i));
    if (predicted === 'flat' || predicted === null) continue;
    const delta = prices[i + 1] - prices[i];
    const actual = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    trials++;
    if (predicted === actual) correct++;
  }
  return trials > 0 ? { accuracy: correct / trials, trials } : null;
}

// Backtests the naive linear-trend signal specifically — kept as its
// own function (rather than inlining backtestSignalWith(predictTrend, …)
// at every call site) since it's the page's default signal, used
// throughout trading.html and covered directly by existing tests.
function backtestSignal(prices, window) {
  return backtestSignalWith(predictTrend, prices, window);
}

// Simple moving average over the last `period` values of `prices`;
// null if there isn't enough data to fill a full window.
function simpleMovingAverage(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Naive moving-average-crossover signal: short-period average above
// long-period average reads as "up," below as "down" — a different,
// classic trend-following heuristic from predictTrend's line fit. Same
// disclaimer: a simple statistics exercise, not a forecast.
function predictTrendMA(prices, shortPeriod = 5, longPeriod = 10) {
  const shortAvg = simpleMovingAverage(prices, shortPeriod);
  const longAvg = simpleMovingAverage(prices, longPeriod);
  if (shortAvg == null || longAvg == null) return null;
  if (shortAvg > longAvg) return 'up';
  if (shortAvg < longAvg) return 'down';
  return 'flat';
}

// Wilder's RSI (relative strength index) over the last `period` changes
// in `prices`, using a simple (not exponential) average of gains/losses
// — the standard 0-100 momentum oscillator. Null if there isn't enough
// data.
function relativeStrengthIndex(prices, period = 14) {
  if (!prices || prices.length < period + 1) return null;
  const recent = prices.slice(-(period + 1));
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i] - recent[i - 1];
    if (change > 0) gainSum += change;
    else lossSum += -change;
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Naive RSI mean-reversion signal: "overbought" (RSI > 70) predicts a
// pullback (down), "oversold" (RSI < 30) predicts a bounce (up),
// otherwise flat. A contrarian idea, deliberately different from the
// trend-following signals above — still naive, still not investment
// advice.
function predictTrendRSI(prices, period = 14) {
  const rsi = relativeStrengthIndex(prices, period);
  if (rsi == null) return null;
  if (rsi > 70) return 'down';
  if (rsi < 30) return 'up';
  return 'flat';
}

// How far a backtested accuracy actually sits from pure chance (50%),
// measured in standard errors under a coin-flip null hypothesis — i.e. a
// rough one-sample z-test. This exists because a headline number like
// "63% (8 tries)" reads as meaningfully better than a coin flip, when
// with only 8 tries it's well within the range plain luck would produce.
// Simplification worth naming: backtest trials come from overlapping
// windows on one price series, so they aren't truly independent samples
// the way a textbook z-test assumes — this is a rough noise-vs-signal
// gut check, not a rigorous significance test. Returns null if there's
// too little data to say anything at all.
function accuracySignificance(accuracy, trials) {
  if (trials < 5) return null;
  const standardError = Math.sqrt(0.25 / trials);
  const z = (accuracy - 0.5) / standardError;
  if (Math.abs(z) < 1) return 'not-significant';
  if (Math.abs(z) < 2) return 'weak';
  return 'notable';
}

// True if the most recent price sits within `thresholdPct` percent above
// the lowest price in the series — a naive "near its recent low" proxy,
// not a real support/resistance analysis.
function isNearLow(prices, thresholdPct) {
  if (!prices || prices.length < 2) return false;
  const low = Math.min(...prices);
  if (low <= 0) return false;
  const current = prices[prices.length - 1];
  return ((current - low) / low) * 100 <= thresholdPct;
}
