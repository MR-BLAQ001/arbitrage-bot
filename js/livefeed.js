/* Live market data feed: pulls REAL public ticker prices from four
 * exchanges (no API keys required). If a request fails (network, CORS,
 * rate limit) that exchange is flagged offline and the rest of the
 * dashboard keeps working on its last known prices.
 */
const LiveFeed = (() => {
  const TIMEOUT_MS = 7000;

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

  /* Per-exchange fetchers. Each returns { "BTC/USDT": price, ... }. */
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
      // Kraken returns canonical keys (XXBTZUSD, XETHZUSD, ...).
      // Match each requested pair by base token + Z<quote> suffix.
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
          const data = await getJSON(
            "https://api.coinbase.com/v2/prices/" + pair + "/spot"
          );
          out[sym] = parseFloat(data.data.spot);
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
