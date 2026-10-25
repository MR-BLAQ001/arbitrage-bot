/* Bot engine: holds settings, decides when to trade, executes via the portfolio.
 * When real trading is armed, opportunities on connected exchanges are
 * executed as REAL market orders (buy leg + sell leg). */
class Bot {
  constructor(portfolio) {
    this.portfolio = portfolio;
    this.running = false;
    this.minSpreadPct = 0.35;   // net spread threshold (%)
    this.maxPosition = 2500;    // max USDT per trade
    this.autoTrade = true;
    this.cooldown = {};         // symbol -> tick index when it may trade again
    this.tickIndex = 0;
    this.onTrade = null;        // callback(trade)
    this.realArmed = false;     // set by main.js when real trading is enabled
  }

  /* Can this opportunity be executed as a REAL trade? */
  realReady(opp) {
    if (!this.realArmed || typeof ExchangeAPI === "undefined") return false;
    const s = ExchangeAPI.state;
    const buyEx = opp.buyEx.id, sellEx = opp.sellEx.id;
    if (!s.connected[buyEx] || !s.connected[sellEx]) return false;
    // need quote funds on the buy exchange and the base coin on the sell exchange
    const base = opp.symbol.split("/")[0];
    if ((s.balances[buyEx] || {}).USDT < 10) return false;
    if ((s.balances[sellEx] || {})[base] <= 0) return false;
    return true;
  }

  /* Called once per market tick. Returns the scanned opportunities. */
  step(market, cfg) {
    this.tickIndex++;
    const opps = scanOpportunities(market, cfg);

    // count opportunities that clear the threshold (for stats)
    for (const o of opps) {
      if (o.netPct >= this.minSpreadPct) this.portfolio.oppSeen++;
    }

    if (this.running && this.autoTrade) {
      // take the single best opportunity that clears threshold + cooldown
      for (const o of opps) {
        if (o.netPct < this.minSpreadPct) break; // sorted desc
        if ((this.cooldown[o.symbol] || 0) > this.tickIndex) continue;
        if (this.realReady(o)) {
          this.cooldown[o.symbol] = this.tickIndex + 8; // longer cooldown for real fills
          this.execute(o, this.maxPosition, "auto", true);
          break;
        }
        const trade = this.execute(o, this.maxPosition, "auto", false);
        if (trade) {
          this.cooldown[o.symbol] = this.tickIndex + 4; // 4-tick cooldown
          if (this.onTrade) this.onTrade(trade);
          break; // one trade per tick
        }
      }
    }
    return opps;
  }

  /* Manual execution of a specific opportunity. */
  manualTrade(opp) {
    const real = this.realReady(opp);
    const trade = this.execute(opp, this.maxPosition, "manual", real);
    if (trade) {
      this.cooldown[opp.symbol] = this.tickIndex + (real ? 8 : 2);
      if (this.onTrade) this.onTrade(trade);
    }
    return trade;
  }

  /* Paper accounting always records the trade; when `real` is true it also
   * fires real market orders on both exchanges (async). */
  execute(opp, size, modeName, real) {
    const trade = this.portfolio.execute(opp, size, modeName);
    if (!trade) return null;
    if (real) {
      trade.real = true;
      trade.realStatus = "executing…";
      this.runRealLegs(opp, size, trade);
    }
    return trade;
  }

  async runRealLegs(opp, size, trade) {
    try {
      const buy = await ExchangeAPI.placeMarketOrder(opp.buyEx.id, {
        side: "BUY", symbol: opp.symbol, amountUsdt: size, price: opp.buyPrice,
      });
      trade.realStatus = "buy filled (" + buy.qty + ")…";
      const sell = await ExchangeAPI.placeMarketOrder(opp.sellEx.id, {
        side: "SELL", symbol: opp.symbol, qty: buy.qty,
      });
      trade.realStatus = "FILLED · sold " + sell.qty;
    } catch (e) {
      trade.realStatus = "FAILED: " + (e && e.message ? e.message : e);
    }
    if (this.onTrade) this.onTrade(trade);
  }

  reset() {
    this.running = false;
    this.cooldown = {};
    this.tickIndex = 0;
  }
}
