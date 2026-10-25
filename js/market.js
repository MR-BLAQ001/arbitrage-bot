/* Multi-exchange market.
 * SIM mode: each symbol has one "fair" price that random-walks. Every
 * exchange quotes fair * (1 + bias + noise + shock). Shocks (price
 * dislocations) appear randomly and decay, creating arbitrage windows.
 * LIVE mode: tick() is a no-op; LiveFeed pushes real exchange quotes
 * through setLivePrice().
 */
class Market {
  constructor(cfg) {
    this.cfg = cfg;
    this.live = false;
    this.common = {};
    this.cells = {};
    for (const s of cfg.symbols) {
      this.common[s.id] = s.base;
      this.cells[s.id] = {};
      for (const e of cfg.exchanges) {
        const price = s.base * (1 + e.bias);
        this.cells[s.id][e.id] = { price, prev: price, shock: 0 };
      }
    }
  }

  /* LIVE mode: replace a cell price with a real exchange quote. */
  setLivePrice(symbol, exId, price) {
    const row = this.cells[symbol];
    const cell = row && row[exId];
    if (cell && isFinite(price) && price > 0) {
      cell.prev = cell.price;
      cell.price = price;
      cell.shock = 0;
    }
  }

  tick() {
    if (this.live) return; // prices come from LiveFeed
    const { symbols, exchanges, divergence, noisePct } = this.cfg;
    for (const s of symbols) {
      // shared random walk of the fair price
      this.common[s.id] *= 1 + (Math.random() - 0.5) * 2 * s.vol;

      for (const e of exchanges) {
        const cell = this.cells[s.id][e.id];
        cell.prev = cell.price;

        // decay an existing dislocation
        cell.shock *= divergence.decay;
        if (Math.abs(cell.shock) < divergence.floor) cell.shock = 0;

        // start a new dislocation
        if (cell.shock === 0 && Math.random() < divergence.chance) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          cell.shock = dir * (divergence.minPct +
            Math.random() * (divergence.maxPct - divergence.minPct));
        }

        const noise = (Math.random() - 0.5) * 2 * noisePct;
        cell.price = this.common[s.id] * (1 + e.bias + cell.shock + noise);
      }
    }
  }
}
