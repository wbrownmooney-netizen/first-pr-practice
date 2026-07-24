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

// Walks the same naive signal forward through history: at each point,
// predict the next step from the preceding `window` prices, then check
// whether that prediction matched what actually happened next. This is
// a backtest over a small recent sample, not a guarantee of future
// performance.
function backtestSignal(prices, window) {
  let correct = 0, trials = 0;
  for (let i = window; i < prices.length - 1; i++) {
    const predicted = predictTrend(prices.slice(i - window, i));
    if (predicted === 'flat' || predicted === null) continue;
    const delta = prices[i + 1] - prices[i];
    const actual = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    trials++;
    if (predicted === actual) correct++;
  }
  return trials > 0 ? { accuracy: correct / trials, trials } : null;
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
