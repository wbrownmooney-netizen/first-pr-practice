// Black-Scholes option pricing — pure math, no DOM or network access, so
// it can be unit tested directly. This is a simplified educational model:
// volatility is estimated from recent price history (see
// historicalVolatility below) rather than pulled from real market-quoted
// implied volatility, so prices here will not match what a real options
// exchange would quote for the same contract. The risk-free rate is the
// one input that IS real market data — trading.html fetches the current
// 3-month Treasury yield and passes it in as `r`.

// Standard normal cumulative distribution function (Abramowitz & Stegun
// approximation — accurate to about 7 decimal places).
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

// Annualized volatility estimated from a series of closing prices — the
// standard deviation of consecutive log returns, scaled up to a yearly
// figure by the number of such periods in a year (2190 for this app's
// 4-hourly crypto candles, 252 for daily stock candles — trading.html
// picks the right one to pass in). This is *historical* volatility
// (what the price actually did), not *implied* volatility (what the
// options market is currently pricing in) — those two commonly differ,
// sometimes a lot, but historical is the one a client-side app can
// compute for free from data it already has, unlike implied volatility
// which requires live options-chain data most free market-data APIs
// don't provide. Needs at least 2 closes to form a single return;
// returns null otherwise rather than a misleading 0.
function historicalVolatility(closes, periodsPerYear) {
  if (!closes || closes.length < 2) return null;
  const logReturns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) * (r - mean), 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
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

// Profit/loss for one position at expiration, for a hypothetical
// underlying price. `side` defaults to 'long' (buying — this was the
// only side the simulator supported before short/writing positions
// were added) so every existing call site and test keeps working
// unchanged. A short position is the mirror image: it profits exactly
// where a long loses, since selling collects the premium up front and
// owes the intrinsic value at expiration instead of receiving it.
// Reuses blackScholesPrice's T<=0 branch (exact intrinsic value) since
// volatility/rate stop mattering once time to expiry hits zero —
// passing 0 for both is safe, not a placeholder guess.
function optionPayoffAtExpiration(kind, strike, premiumPaid, quantity, underlyingPrice, side) {
  const intrinsic = blackScholesPrice(kind, underlyingPrice, strike, 0, 0, 0);
  const longPayoff = (intrinsic - premiumPaid) * quantity;
  return side === 'short' ? -longPayoff : longPayoff;
}

// The underlying price at which a position neither gains nor loses —
// the same for long and short (only the P/L sign on either side of it
// flips), and independent of quantity, since quantity only scales the
// P/L curve without shifting where it crosses zero.
function optionBreakeven(kind, strike, premiumPaid) {
  return kind === 'call' ? strike + premiumPaid : strike - premiumPaid;
}

// Best/worst case P/L at expiration for one position — used to label a
// payoff diagram honestly, especially the cases where risk is
// unbounded (a naked short call can lose an unlimited amount as the
// underlying rises; a naked short put's loss is large but bounded,
// since the underlying can't fall below $0). Unbounded values are
// returned as null with the matching `*Bounded: false` flag, rather
// than Infinity, so callers never have to special-case a magic number.
function optionRiskProfile(kind, side, strike, premiumPaid, quantity) {
  const totalPremium = premiumPaid * quantity;
  const boundedGain = (strike * quantity) - totalPremium;
  if (side === 'long') {
    return kind === 'call'
      ? { maxLoss: totalPremium, maxLossBounded: true, maxGain: null, maxGainBounded: false }
      : { maxLoss: totalPremium, maxLossBounded: true, maxGain: boundedGain, maxGainBounded: true };
  }
  return kind === 'call'
    ? { maxGain: totalPremium, maxGainBounded: true, maxLoss: null, maxLossBounded: false }
    : { maxGain: totalPremium, maxGainBounded: true, maxLoss: boundedGain, maxLossBounded: true };
}

// Combined profit/loss at expiration for a group of option legs, plus
// optionally one spot (underlying) holding — for strategies like a
// Covered Call or Protective Put, where P/L includes the stock/coin
// itself, not just the option. Spot P/L is unrealized:
// (underlyingPrice - avgCost) * quantity, the same math the rest of
// this app already uses for unrealized spot P/L. A spread or straddle
// just omits `spotLeg`. Each entry in `optionLegs` uses `optionType`
// (not `kind`) deliberately — it's the same field name
// `paperState.options` entries already use, so a group of legs pulled
// straight from paperState can be passed in with no remapping.
function combinedPayoffAtExpiration(optionLegs, underlyingPrice, spotLeg) {
  const optionsTotal = optionLegs.reduce((sum, leg) =>
    sum + optionPayoffAtExpiration(leg.optionType, leg.strike, leg.premiumPaid, leg.quantity, underlyingPrice, leg.side), 0);
  const spotTotal = spotLeg ? (underlyingPrice - spotLeg.avgCost) * spotLeg.quantity : 0;
  return optionsTotal + spotTotal;
}

// Five named strategies' best/worst-case P/L at expiration, computed
// analytically per strategy shape rather than estimated numerically —
// same reasoning as optionRiskProfile: every other figure on this page
// is exact math wherever an exact answer exists, and each of these has
// a standard closed-form result. All return the same
// {maxGain, maxGainBounded, maxLoss, maxLossBounded} shape
// optionRiskProfile uses, so display code never has to branch on shape.

// Long the lower strike (K1) call, short the higher strike (K2) call,
// same expiry. Caps both cost and upside compared to a naked long call.
function bullCallSpreadRiskProfile(longStrike, longPremium, shortStrike, shortPremium, quantity) {
  const netDebit = (longPremium - shortPremium) * quantity;
  const width = (shortStrike - longStrike) * quantity;
  return { maxLoss: netDebit, maxLossBounded: true, maxGain: width - netDebit, maxGainBounded: true };
}

// Long the higher strike (K1) put, short the lower strike (K2) put,
// same expiry. Caps both cost and upside compared to a naked long put.
function bearPutSpreadRiskProfile(longStrike, longPremium, shortStrike, shortPremium, quantity) {
  const netDebit = (longPremium - shortPremium) * quantity;
  const width = (longStrike - shortStrike) * quantity;
  return { maxLoss: netDebit, maxLossBounded: true, maxGain: width - netDebit, maxGainBounded: true };
}

// Long a call and a put at the same strike and expiry — bets on a big
// move in either direction. Max loss (both premiums) occurs exactly at
// the strike, where both legs expire worthless; max gain is unbounded
// since the long call dominates as the price rises without limit.
function longStraddleRiskProfile(strike, callPremium, putPremium, quantity) {
  const totalPremium = (callPremium + putPremium) * quantity;
  return { maxLoss: totalPremium, maxLossBounded: true, maxGain: null, maxGainBounded: false };
}

// Own the underlying, sell a call against it. Max gain is capped at
// being "called away" at the strike (plus the premium kept); max loss
// is bounded (not eliminated) since the premium only partially offsets
// the stock falling all the way to $0.
function coveredCallRiskProfile(spotAvgCost, callStrike, callPremium, quantity) {
  const maxGain = ((callStrike - spotAvgCost) + callPremium) * quantity;
  const maxLoss = (spotAvgCost - callPremium) * quantity;
  return { maxGain, maxGainBounded: true, maxLoss, maxLossBounded: true };
}

// Own the underlying, buy a put as insurance. Max loss is bounded — the
// put floors how far down the combined position can go, at the cost of
// the premium; max gain is unbounded, since the stock's upside is
// uncapped and the put simply expires worthless.
function protectivePutRiskProfile(spotAvgCost, putStrike, putPremium, quantity) {
  const maxLoss = ((spotAvgCost - putStrike) + putPremium) * quantity;
  return { maxGain: null, maxGainBounded: false, maxLoss, maxLossBounded: true };
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
