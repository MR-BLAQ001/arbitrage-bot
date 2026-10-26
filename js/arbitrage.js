/* Arbitrage scanner: for each symbol find the cheapest exchange to buy
 * and the (different) richest exchange to sell, and compute the gross
 * and fee-adjusted (net) spread.
 *
 * @param {Object} market - Market instance
 * @param {Object} cfg - CONFIG object
 * @param {string|null} search - optional search term; only symbols matching
 *        this (case-insensitive, on symbol id) are returned
 */
function scanOpportunities(market, cfg, search = null) {
  const term = (search || "").toLowerCase();
  const opps = [];
  for (const s of cfg.symbols) {
    if (term && !s.id.toLowerCase().includes(term)) continue;
    const ranked = cfg.exchanges
      .map(e => ({ ex: e, cell: market.cells[s.id][e.id] }))
      .sort((a, b) => a.cell.price - b.cell.price);

    const buy = ranked[0];
    const sell = ranked.find(r => r.ex.id !== buy.ex.id) || null;
    if (!sell) continue;

    const gross = (sell.cell.price - buy.cell.price) / buy.cell.price;
    const fees = buy.ex.fee + sell.ex.fee;
    const net = gross - fees;

    opps.push({
      symbol: s.id,
      buyEx: buy.ex,
      sellEx: sell.ex,
      buyPrice: buy.cell.price,
      sellPrice: sell.cell.price,
      grossPct: gross * 100,
      netPct: net * 100,
      executable: net > 0,
    });
  }
  return opps.sort((a, b) => b.netPct - a.netPct);
}

/* Map of symbol -> {buyExId, sellExId, minPrice, maxPrice} for board highlighting. */
function boardMarks(opps) {
  const marks = {};
  for (const o of opps) {
    marks[o.symbol] = {
      buyExId: o.buyEx.id,
      sellExId: o.sellEx.id,
      minPrice: o.buyPrice,
      maxPrice: o.sellPrice,
    };
  }
  return marks;
}

/* Filter a list of symbols by search term (case-insensitive substring match). */
function filterSymbols(symbols, search = null) {
  const term = (search || "").toLowerCase();
  if (!term) return symbols;
  return symbols.filter(s => s.id.toLowerCase().includes(term));
}
