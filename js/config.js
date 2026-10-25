/* Static configuration for the arbitrage bot.
 * SIM mode: every exchange quotes the shared fair price with a small
 * bias, plus random dislocations (see market.js).
 * LIVE mode: real public ticker prices are fetched for the `live`
 * symbol maps below (no API keys required).
 */
const CONFIG = {
  startingBalance: 10000,
  tickMs: 1000,
  livePollMs: 5000,

  exchanges: [
    {
      id: "binance", name: "Binance", fee: 0.0010, bias: 0.00000,
      live: { symbols: { "BTC/USDT": "BTCUSDT", "ETH/USDT": "ETHUSDT", "SOL/USDT": "SOLUSDT", "XRP/USDT": "XRPUSDT" } },
    },
    {
      id: "kraken", name: "Kraken", fee: 0.0026, bias: 0.00015,
      live: { symbols: { "BTC/USDT": "XBT/USD", "ETH/USDT": "ETH/USD", "SOL/USDT": "SOL/USD", "XRP/USDT": "XRP/USD" } },
    },
    {
      id: "coinbase", name: "Coinbase", fee: 0.0040, bias: -0.00010,
      live: { symbols: { "BTC/USDT": "BTC-USD", "ETH/USDT": "ETH-USD", "SOL/USDT": "SOL-USD", "XRP/USDT": "XRP-USD" } },
    },
    {
      id: "kucoin", name: "KuCoin", fee: 0.0010, bias: 0.00005,
      live: { symbols: { "BTC/USDT": "BTC-USDT", "ETH/USDT": "ETH-USDT", "SOL/USDT": "SOL-USDT", "XRP/USDT": "XRP-USDT" } },
    },
  ],

  symbols: [
    { id: "BTC/USDT", base: 67420,  vol: 0.0004 },
    { id: "ETH/USDT", base: 3512,   vol: 0.0006 },
    { id: "SOL/USDT", base: 148.6,  vol: 0.0009 },
    { id: "XRP/USDT", base: 0.6240, vol: 0.0011 },
  ],

  /* Random price dislocations that create arbitrage windows (SIM only). */
  divergence: {
    chance: 0.055,      // per exchange/symbol per tick
    minPct: 0.002,      // 0.20%
    maxPct: 0.012,      // 1.20%
    decay: 0.55,        // shock multiplier per tick
    floor: 0.0004,      // below this the shock is cleared
  },

  noisePct: 0.00012,    // per-tick micro noise per cell (SIM only)
};
