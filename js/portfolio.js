/* Paper-trading portfolio: balance, realized P&L, fees and trade history. */
class Portfolio {
  constructor(start) {
    this.reset(start);
  }

  reset(start) {
    this.starting = start;
    this.balance = start;
    this.realized = 0;
    this.fees = 0;
    this.trades = [];
    this.oppSeen = 0;
  }

  /* Execute an instant buy-on-A / sell-on-B round trip of `size` USDT.
   * Returns the trade record. */
  execute(opp, size, mode) {
    size = Math.min(size, this.balance);
    if (size < 1) return null;

    const buyFee = size * opp.buyEx.fee;
    const qty = (size - buyFee) / opp.buyPrice;
    const sellValue = qty * opp.sellPrice;
    const sellFee = sellValue * opp.sellEx.fee;
    const proceeds = sellValue - sellFee;
    const pnl = proceeds - size;

    this.balance += pnl;
    this.realized += pnl;
    this.fees += buyFee + sellFee;

    const trade = {
      id: this.trades.length + 1,
      time: new Date(),
      symbol: opp.symbol,
      buyEx: opp.buyEx.name,
      sellEx: opp.sellEx.name,
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice,
      size,
      fees: buyFee + sellFee,
      pnl,
      mode, // "auto" | "manual"
    };
    this.trades.unshift(trade);
    if (this.trades.length > 200) this.trades.pop();
    return trade;
  }

  get roiPct() {
    return (this.realized / this.starting) * 100;
  }

  get wins() {
    return this.trades.filter(t => t.pnl > 0).length;
  }

  get winRate() {
    return this.trades.length ? (this.wins / this.trades.length) * 100 : null;
  }

  get best() {
    return this.trades.length ? Math.max(...this.trades.map(t => t.pnl)) : null;
  }

  get worst() {
    return this.trades.length ? Math.min(...this.trades.map(t => t.pnl)) : null;
  }
}
