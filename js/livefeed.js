/* Live market data feed: pulls REAL public ticker prices from ten
 * exchanges (no API keys required). If a request fails (network, CORS,
 * rate limit) that exchange is flagged offline and the rest of the
 * dashboard keeps working on its last known prices.
 */
const LiveFeed = (() => {
  const TIMEOUT_MS = 8000;

  const status = {}; // exId -> { ok, ts, error }
  let timer = null;
  let busy = false;

  for (const e of CONFIG.exchanges) {
    status[e.id] = { ok: false, ts: null, error: null };
  }

  async function getJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /* Per-exchange fetchers. Each returns { "BTC/USDT": price, ... }.
   * Exchanges that support bulk ticker endpoints fetch everything once
   * and filter locally; others request only the symbols we track.
   */
  const fetchers = {
    async binance(ex) {
      const syms = Object.values(ex.live.symbols).map(s => `"${s}"`).join(",");
      const data = await getJSON(
        "https://api.binance.com/api/v3/ticker/price?symbols=[" + syms + "]"
      );
      const out = {};
      for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
        const row = data.find(d => d.symbol === exSym);
        if (row) out[sym] = parseFloat(row.price);
      }
      return out;
    },

    async kraken(ex) {
      const pairs = Object.values(ex.live.symbols).join(",");
      const data = await getJSON(
        "https://api.kraken.com/0/public/Ticker?pair=" + encodeURIComponent(pairs)
      );
      if (data.error && data.error.length) throw new Error(data.error.join(", "));
      const out = {};
      for (const [sym, pair] of Object.entries(ex.live.symbols)) {
        const [base, quote] = pair.split("/");
        const key = Object.keys(data.result).find(
          k => k.includes(base) && k.endsWith("Z" + quote)
        );
        if (key) out[sym] = parseFloat(data.result[key].c[0]);
      }
      return out;
    },

    async coinbase(ex) {
      const out = {};
      await Promise.all(
        Object.entries(ex.live.symbols).map(async ([sym, pair]) => {
          try {
            const data = await getJSON(
              "https://api.coinbase.com/v2/prices/" + pair + "/spot"
            );
            out[sym] = parseFloat(data.data.spot);
          } catch (e) {
            // Coinbase may not list some pairs; skip silently
          }
        })
      );
      return out;
    },

    async kucoin(ex) {
      const data = await getJSON("https://api.kucoin.com/api/v1/market/allTickers");
      const out = {};
      for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
        const row = data.data.ticker.find(t => t.symbol === exSym);
        if (row) out[sym] = parseFloat(row.last);
      }
      return out;
    },

    async okx(ex) {
      const data = await getJSON(
        "https://www.okx.com/api/v5/market/tickers?instType=SPOT"
      );
      const out = {};
      if (data.data) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.data.find(t => t.instId === exSym);
          if (row) out[sym] = parseFloat(row.last);
        }
      }
      return out;
    },

    async bybit(ex) {
      const data = await getJSON(
        "https://api.bybit.com/v5/market/tickers?category=spot"
      );
      const out = {};
      if (data.result && data.result.list) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.result.list.find(t => t.symbol === exSym);
          if (row) out[sym] = parseFloat(row.lastPrice);
        }
      }
      return out;
    },

    async gateio(ex) {
      const data = await getJSON("https://api.gateio.ws/api/v4/spot/tickers");
      const out = {};
      if (Array.isArray(data)) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.find(t => t.currency_pair === exSym);
          if (row) out[sym] = parseFloat(row.last);
        }
      }
      return out;
    },

    async htx(ex) {
      const data = await getJSON("https://api.huobi.pro/market/tickers");
      const out = {};
      if (data.data) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.data.find(t => t.symbol === exSym);
          if (row) out[sym] = parseFloat(row.close);
        }
      }
      return out;
    },

    async bitget(ex) {
      const data = await getJSON(
        "https://api.bitget.com/api/v2/spot/market/tickers"
      );
      const out = {};
      if (data.data) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.data.find(t => t.symbol === exSym);
          if (row) out[sym] = parseFloat(row.last);
        }
      }
      return out;
    },

    async mexc(ex) {
      const data = await getJSON("https://api.mexc.com/api/v3/ticker/price");
      const out = {};
      if (Array.isArray(data)) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.find(t => t.symbol === exSym);
          if (row) out[sym] = parseFloat(row.price);
        }
      }
      return out;
    },

    async bingx(ex) {
      const data = await getJSON(
        "https://open-api.bingx.com/openApi/spot/v1/ticker/price"
      );
      const out = {};
      if (data.data) {
        for (const [sym, exSym] of Object.entries(ex.live.symbols)) {
          const row = data.data.find(t => t.symbol === exSym);
          if (row) out[sym] = parseFloat(row.price);
        }
      }
      return out;
    },
  };

  /* One polling round: refresh every exchange in parallel. */
  async function pollOnce(market) {
    if (busy) return;
    busy = true;
    try {
      await Promise.all(
        CONFIG.exchanges.map(async ex => {
          const fn = fetchers[ex.id];
          if (!fn) return;
          try {
            const prices = await fn(ex);
            for (const [sym, price] of Object.entries(prices)) {
              market.setLivePrice(sym, ex.id, price);
            }
            status[ex.id] = { ok: true, ts: Date.now(), error: null };
          } catch (err) {
            status[ex.id] = {
              ok: false,
              ts: status[ex.id].ts,
              error: (err && err.message) || String(err),
            };
          }
        })
      );
    } finally {
      busy = false;
    }
  }

  function start(market) {
    stop();
    pollOnce(market);
    timer = setInterval(() => pollOnce(market), CONFIG.livePollMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, status, pollOnce };
})();
