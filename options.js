// Black-Scholes option pricing — pure math, no DOM or network access, so
// it can be unit tested directly. This is a simplified educational model:
// it assumes a fixed volatility and a 0% risk-free rate rather than using
// real market-implied volatility, so prices here will not match what a
// real options exchange would quote for the same contract.

// Standard normal cumulative distribution function (Abramowitz & Stegun
// approximation — accurate to about 7 decimal places).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

// kind: 'call' or 'put'. S = current underlying price, K = strike,
// T = time to expiration in years, r = risk-free rate (annualized),
// sigma = volatility (annualized). At or past expiration (T <= 0),
// returns exact intrinsic value rather than dividing by zero.
function blackScholesPrice(kind, S, K, T, r, sigma) {
  if (T <= 0) {
    return kind === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (kind === 'call') {
    return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  }
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}
