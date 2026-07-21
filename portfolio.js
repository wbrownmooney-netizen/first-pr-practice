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
// basis of the remaining shares is unchanged — only realized gain
// differs, which this simulator doesn't track separately. Throws if
// there isn't enough quantity held to sell.
function sellPosition(position, quantity) {
  if (!position || position.quantity < quantity) {
    throw new Error('Insufficient quantity to sell');
  }
  return { quantity: position.quantity - quantity, avgCost: position.avgCost };
}
