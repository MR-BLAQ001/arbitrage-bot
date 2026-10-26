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
      live: { symbols: {
        "BTC/USDT": "BTCUSDT", "ETH/USDT": "ETHUSDT", "SOL/USDT": "SOLUSDT",
        "XRP/USDT": "XRPUSDT", "ADA/USDT": "ADAUSDT", "DOGE/USDT": "DOGEUSDT",
        "AVAX/USDT": "AVAXUSDT", "DOT/USDT": "DOTUSDT", "MATIC/USDT": "MATICUSDT",
        "LINK/USDT": "LINKUSDT", "TRX/USDT": "TRXUSDT", "LTC/USDT": "LTCUSDT",
        "BCH/USDT": "BCHUSDT", "ETC/USDT": "ETCUSDT",
      } },
    },
    {
      id: "kraken", name: "Kraken", fee: 0.0026, bias: 0.00015,
      live: { symbols: {
        "BTC/USDT": "XBT/USD", "ETH/USDT": "ETH/USD", "SOL/USDT": "SOL/USD",
        "XRP/USDT": "XRP/USD", "ADA/USDT": "ADA/USD", "DOGE/USDT": "DOGE/USD",
        "AVAX/USDT": "AVAX/USD", "DOT/USDT": "DOT/USD", "MATIC/USDT": "MATIC/USD",
        "LINK/USDT": "LINK/USD", "TRX/USDT": "TRX/USD", "LTC/USDT": "LTC/USD",
        "BCH/USDT": "BCH/USD", "ETC/USDT": "ETC/USD",
      } },
    },
    {
      id: "coinbase", name: "Coinbase", fee: 0.0040, bias: -0.00010,
      live: { symbols: {
        "BTC/USDT": "BTC-USD", "ETH/USDT": "ETH-USD", "SOL/USDT": "SOL-USD",
        "XRP/USDT": "XRP-USD", "ADA/USDT": "ADA-USD", "DOGE/USDT": "DOGE-USD",
        "AVAX/USDT": "AVAX-USD", "DOT/USDT": "DOT-USD", "MATIC/USDT": "MATIC-USD",
        "LINK/USDT": "LINK-USD", "TRX/USDT": "TRX-USD", "LTC/USDT": "LTC-USD",
        "BCH/USDT": "BCH-USD", "ETC/USDT": "ETC-USD",
      } },
    },
    {
      id: "kucoin", name: "KuCoin", fee: 0.0010, bias: 0.00005,
      live: { symbols: {
        "BTC/USDT": "BTC-USDT", "ETH/USDT": "ETH-USDT", "SOL/USDT": "SOL-USDT",
        "XRP/USDT": "XRP-USDT", "ADA/USDT": "ADA-USDT", "DOGE/USDT": "DOGE-USDT",
        "AVAX/USDT": "AVAX-USDT", "DOT/USDT": "DOT-USDT", "MATIC/USDT": "MATIC-USDT",
        "LINK/USDT": "LINK-USDT", "TRX/USDT": "TRX-USDT", "LTC/USDT": "LTC-USDT",
        "BCH/USDT": "BCH-USDT", "ETC/USDT": "ETC-USDT",
      } },
    },
    {
      id: "okx", name: "OKX", fee: 0.0010, bias: 0.00002,
      live: { symbols: {
        "BTC/USDT": "BTC-USDT", "ETH/USDT": "ETH-USDT", "SOL/USDT": "SOL-USDT",
        "XRP/USDT": "XRP-USDT", "ADA/USDT": "ADA-USDT", "DOGE/USDT": "DOGE-USDT",
        "AVAX/USDT": "AVAX-USDT", "DOT/USDT": "DOT-USDT", "MATIC/USDT": "MATIC-USDT",
        "LINK/USDT": "LINK-USDT", "TRX/USDT": "TRX-USDT", "LTC/USDT": "LTC-USDT",
        "BCH/USDT": "BCH-USDT", "ETC/USDT": "ETC-USDT",
      } },
    },
    {
      id: "bybit", name: "Bybit", fee: 0.0010, bias: 0.00003,
      live: { symbols: {
        "BTC/USDT": "BTCUSDT", "ETH/USDT": "ETHUSDT", "SOL/USDT": "SOLUSDT",
        "XRP/USDT": "XRPUSDT", "ADA/USDT": "ADAUSDT", "DOGE/USDT": "DOGEUSDT",
        "AVAX/USDT": "AVAXUSDT", "DOT/USDT": "DOTUSDT", "MATIC/USDT": "MATICUSDT",
        "LINK/USDT": "LINKUSDT", "TRX/USDT": "TRXUSDT", "LTC/USDT": "LTCUSDT",
        "BCH/USDT": "BCHUSDT", "ETC/USDT": "ETCUSDT",
      } },
    },
    {
      id: "gateio", name: "Gate.io", fee: 0.0020, bias: 0.00004,
      live: { symbols: {
        "BTC/USDT": "BTC_USDT", "ETH/USDT": "ETH_USDT", "SOL/USDT": "SOL_USDT",
        "XRP/USDT": "XRP_USDT", "ADA/USDT": "ADA_USDT", "DOGE/USDT": "DOGE_USDT",
        "AVAX/USDT": "AVAX_USDT", "DOT/USDT": "DOT_USDT", "MATIC/USDT": "MATIC_USDT",
        "LINK/USDT": "LINK_USDT", "TRX/USDT": "TRX_USDT", "LTC/USDT": "LTC_USDT",
        "BCH/USDT": "BCH_USDT", "ETC/USDT": "ETC_USDT",
      } },
    },
    {
      id: "htx", name: "HTX", fee: 0.0020, bias: -0.00002,
      live: { symbols: {
        "BTC/USDT": "btcusdt", "ETH/USDT": "ethusdt", "SOL/USDT": "solusdt",
        "XRP/USDT": "xrpusdt", "ADA/USDT": "adausdt", "DOGE/USDT": "dogeusdt",
        "AVAX/USDT": "avaxusdt", "DOT/USDT": "dotusdt", "MATIC/USDT": "maticusdt",
        "LINK/USDT": "linkusdt", "TRX/USDT": "trxusdt", "LTC/USDT": "ltcusdt",
        "BCH/USDT": "bchusdt", "ETC/USDT": "etcusdt",
      } },
    },
    {
      id: "bitget", name: "Bitget", fee: 0.0010, bias: 0.00001,
      live: { symbols: {
        "BTC/USDT": "BTCUSDT", "ETH/USDT": "ETHUSDT", "SOL/USDT": "SOLUSDT",
        "XRP/USDT": "XRPUSDT", "ADA/USDT": "ADAUSDT", "DOGE/USDT": "DOGEUSDT",
        "AVAX/USDT": "AVAXUSDT", "DOT/USDT": "DOTUSDT", "MATIC/USDT": "MATICUSDT",
        "LINK/USDT": "LINKUSDT", "TRX/USDT": "TRXUSDT", "LTC/USDT": "LTCUSDT",
        "BCH/USDT": "BCHUSDT", "ETC/USDT": "ETCUSDT",
      } },
    },
    {
      id: "mexc", name: "MEXC", fee: 0.0020, bias: 0.00003,
      live: { symbols: {
        "BTC/USDT": "BTC_USDT", "ETH/USDT": "ETH_USDT", "SOL/USDT": "SOL_USDT",
        "XRP/USDT": "XRP_USDT", "ADA/USDT": "ADA_USDT", "DOGE/USDT": "DOGE_USDT",
        "AVAX/USDT": "AVAX_USDT", "DOT/USDT": "DOT_USDT", "MATIC/USDT": "MATIC_USDT",
        "LINK/USDT": "LINK_USDT", "TRX/USDT": "TRX_USDT", "LTC/USDT": "LTC_USDT",
        "BCH/USDT": "BCH_USDT", "ETC/USDT": "ETC_USDT",
      } },
    },
    {
      id: "bingx", name: "BingX", fee: 0.0010, bias: 0.00004,
      live: { symbols: {
        "BTC/USDT": "BTC-USDT", "ETH/USDT": "ETH-USDT", "SOL/USDT": "SOL-USDT",
        "XRP/USDT": "XRP-USDT", "ADA/USDT": "ADA-USDT", "DOGE/USDT": "DOGE-USDT",
        "AVAX/USDT": "AVAX-USDT", "DOT/USDT": "DOT-USDT", "MATIC/USDT": "MATIC-USDT",
        "LINK/USDT": "LINK-USDT", "TRX/USDT": "TRX-USDT", "LTC/USDT": "LTC-USDT",
        "BCH/USDT": "BCH-USDT", "ETC/USDT": "ETC-USDT",
      } },
    },
  ],

  symbols: [
    { id: "BTC/USDT", base: 67420,  vol: 0.0004 },
    { id: "ETH/USDT", base: 3512,   vol: 0.0006 },
    { id: "SOL/USDT", base: 148.6,  vol: 0.0009 },
    { id: "XRP/USDT", base: 0.6240, vol: 0.0011 },
    { id: "ADA/USDT", base: 0.45,   vol: 0.0012 },
    { id: "DOGE/USDT", base: 0.16,  vol: 0.0015 },
    { id: "AVAX/USDT", base: 38.5,  vol: 0.0011 },
    { id: "DOT/USDT", base: 7.2,    vol: 0.0013 },
    { id: "MATIC/USDT", base: 0.68, vol: 0.0014 },
    { id: "LINK/USDT", base: 21.4,  vol: 0.0010 },
    { id: "TRX/USDT", base: 0.28,   vol: 0.0016 },
    { id: "LTC/USDT", base: 98.5,   vol: 0.0009 },
    { id: "BCH/USDT", base: 412.0,  vol: 0.0010 },
    { id: "ETC/USDT", base: 31.2,   vol: 0.0013 },
  ],

  /* Flash‑loan receiver configuration (LIVE mode).
   * Deploy contracts/FlashLoanReceiver.sol, then fill in:
   *  - address: your deployed receiver
   *  - aavePool: the Aave v3 Pool on that network
   *  - routerA / routerB: two DEX routers (e.g. Uniswap V2 + SushiSwap)
   * Goerli reference values (fill in what you deployed / the tokens you want):
   *   Aave v3 Pool (Goerli): 0x9A99D27b130Bf251fDD7433EDf3819c6e6B01478
   *   WETH (Goerli):         0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
   *   DAI (Goerli):          0x1111111111166b0C2F75166Bc151715D96d4438f
   */
  flashLoanReceiver: {
    address: "0x…",        // <-- your deployed FlashLoanReceiver
    aavePool: "0x9A99D27b130Bf251fDD7433EDf3819c6e6B01478", // Aave v3 Pool (Goerli)
    routerA: "0x…",        // e.g. Uniswap V2 router
    routerB: "0x…",        // e.g. SushiSwap router
    defaultAsset: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",   // WETH
    defaultIntermediate: "0x1111111111166b0C2F75166Bc151715D96d4438f", // DAI
    abi: [
      "function initiateFlashLoan(address asset, uint256 amount, address intermediateToken) external",
      "function setRouters(address _routerA, address _routerB) external",
      "function setSlippage(uint256 bps) external",
      "function pool() external view returns (address)",
      "function owner() external view returns (address)",
      "function routerA() external view returns (address)",
      "function routerB() external view returns (address)",
      "function slippageBps() external view returns (uint256)",
      "event ArbitrageExecuted(address indexed asset, uint256 borrowed, uint256 profit)",
      "event RoutersSet(address indexed routerA, address indexed routerB)",
    ],
  },

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
