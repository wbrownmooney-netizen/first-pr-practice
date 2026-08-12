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

// Profit/loss for one long position (this simulator only ever buys,
// never writes/sells, options — "long call"/"long put" is every
// position it can hold) at expiration, for a hypothetical underlying
// price. Reuses blackScholesPrice's T<=0 branch (exact intrinsic value)
// since volatility/rate stop mattering once time to expiry hits zero —
// passing 0 for both is safe, not a placeholder guess.
function optionPayoffAtExpiration(kind, strike, premiumPaid, quantity, underlyingPrice) {
  const intrinsic = blackScholesPrice(kind, underlyingPrice, strike, 0, 0, 0);
  return (intrinsic - premiumPaid) * quantity;
}

// The underlying price at which a long position neither gains nor
// loses — independent of quantity, since quantity only scales the P/L
// curve without shifting where it crosses zero.
function optionBreakeven(kind, strike, premiumPaid) {
  return kind === 'call' ? strike + premiumPaid : strike - premiumPaid;
}

// Educational breakdown of *why* an option's value moved between two
// points in time. Since this simulator holds volatility fixed per asset
// class, the only two things that actually change between opening and
// now are the underlying price and the time remaining — so the change
// in value can be decomposed into a "what if only time had passed"
// component and a "what if only the price had moved" component. These
// two rarely sum exactly to the real change, since option value isn't
// linear in either variable (that's convexity/gamma) — the leftover is
// reported as `interaction` rather than silently absorbed into either
// figure, so the breakdown stays honest about not being a clean split.
function decomposeOptionChange(kind, strike, r, sigma, priceStart, timeStart, priceNow, timeNow) {
  const startValue = blackScholesPrice(kind, priceStart, strike, timeStart, r, sigma);
  const endValue = blackScholesPrice(kind, priceNow, strike, timeNow, r, sigma);
  const timeOnlyValue = blackScholesPrice(kind, priceStart, strike, timeNow, r, sigma);
  const priceOnlyValue = blackScholesPrice(kind, priceNow, strike, timeStart, r, sigma);
  const timeDecay = timeOnlyValue - startValue;
  const priceMove = priceOnlyValue - startValue;
  const interaction = endValue - startValue - timeDecay - priceMove;
  return { startValue, endValue, timeDecay, priceMove, interaction };
}
