// Pure position math for the paper trading simulator — no DOM or network
// access, so it can be unit tested directly.

// Applies a buy of `quantity` units at `price` to an existing position
// (or none), returning the new position with a recalculated
// weighted-average cost basis.
function buyPosition(position, quantity, price) {
  const existing = position || { quantity: 0, avgCost: 0 };
  const newQuantity = existing.quantity + quantity;
  const newAvgCost = (existing.avgCost * existing.quantity + price * quantity) / newQuantity;
  return { quantity: newQuantity, avgCost: newAvgCost };
}

// Applies a sell of `quantity` units from an existing position. Cost
// basis of the remaining shares is unchanged — realized gain on the
// sold portion is computed separately, via realizedGain() below. Throws
// if there isn't enough quantity held to sell.
function sellPosition(position, quantity) {
  if (!position || position.quantity < quantity) {
    throw new Error('Insufficient quantity to sell');
  }
  return { quantity: position.quantity - quantity, avgCost: position.avgCost };
}

// Profit or loss actually locked in by selling `quantity` units at
// `exitPrice`, against a cost basis of `costBasis` per unit (a
// position's avgCost for spot sells, or an option's premiumPaid for
// closing a contract — same formula either way).
function realizedGain(costBasis, exitPrice, quantity) {
  return (exitPrice - costBasis) * quantity;
}

// Compares average holding time of winning vs. losing closed trades, to
// surface a well-documented behavioral-finance tendency (the
// "disposition effect"): selling winners quickly while holding losers,
// hoping they recover. Only looks at trade-history entries that carry
// both a realizedPL and a heldMs (older saved state, and breakeven
// trades where realizedPL is exactly 0, are excluded rather than
// guessed at). Requires at least `minTrades` winners and losers before
// saying anything — with less data than that, any average is mostly
// noise, not a real pattern (same spirit as accuracySignificance() in
// signals.js).
function holdingTimeBias(history, minTrades = 3) {
  const closed = history.filter(t => t.realizedPL != null && t.heldMs != null);
  const winners = closed.filter(t => t.realizedPL > 0);
  const losers = closed.filter(t => t.realizedPL < 0);
  if (winners.length < minTrades || losers.length < minTrades) return null;
  const avgMs = trades => trades.reduce((sum, t) => sum + t.heldMs, 0) / trades.length;
  return {
    avgWinnerMs: avgMs(winners),
    avgLoserMs: avgMs(losers),
    winners: winners.length,
    losers: losers.length
  };
}
