/* Paper-trading portfolio: balance, realized P&L, fees, withdrawals and equity history. */
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
    /* lifetime counters (trades array is capped, these are not) */
    this.tradesTotal = 0;
    this.winsTotal = 0;
    this.lossesTotal = 0;
    this.peakBalance = start;
    /* withdrawals */
    this.withdrawals = [];
    this.totalWithdrawn = 0;
    /* equity curve (balance snapshots over time) */
    this.equity = [start];
  }

  /* Record a balance snapshot for the equity chart (call every few ticks). */
  snapshot() {
    this.equity.push(this.balance);
    if (this.equity.length > 600) this.equity.shift();
  }

  /* Paper withdrawal: moves money out of the bot balance. */
  withdraw(amount) {
    amount = Math.floor(amount * 100) / 100;
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a valid amount" };
    if (amount > this.balance) return { ok: false, error: "Amount exceeds balance (" + this.balance.toFixed(2) + ")" };
    this.balance -= amount;
    this.totalWithdrawn += amount;
    const w = { id: this.withdrawals.length + 1, time: new Date(), amount };
    this.withdrawals.unshift(w);
    if (this.withdrawals.length > 50) this.withdrawals.pop();
    return { ok: true, w };
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
    this.tradesTotal++;
    if (pnl > 0) this.winsTotal++; else this.lossesTotal++;
    if (this.balance > this.peakBalance) this.peakBalance = this.balance;

    const trade = {
      id: this.tradesTotal,
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

  get netWorth() {
    return this.balance + this.totalWithdrawn;
  }

  get lifetimeWinRate() {
    return this.tradesTotal ? (this.winsTotal / this.tradesTotal) * 100 : null;
  }

  /* ---- windowed stats from the (capped) trades array ---- */
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
