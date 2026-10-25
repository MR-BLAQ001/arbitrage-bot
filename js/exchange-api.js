/* Real exchange order execution (Binance + KuCoin REST, browser-compatible).
 *
 * - Credentials are stored only in this device's localStorage.
 * - Binance defaults to the official TESTNET (testnet.binance.vision);
 *   switch to production only when you are sure.
 * - Use "trade-only" API keys (no withdrawal permission).
 * - No profit is guaranteed: real spreads are thin and fees eat into them.
 */
const ExchangeAPI = (() => {
  const LS_KEY = "arb-bot-creds-v1";
  const TIMEOUT_MS = 10000;

  const state = {
    enabled: false,
    connected: { binance: false, kucoin: false },
    balances: { binance: {}, kucoin: {} }, // asset -> free amount
  };

  const supported = { binance: true, kucoin: true };

  /* ---------- credentials ---------- */
  function getCreds() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveCreds(creds) {
    localStorage.setItem(LS_KEY, JSON.stringify(creds));
  }

  /* ---------- crypto helpers ---------- */
  async function hmac(secret, message) {
    if (!crypto.subtle) throw new Error("Web Crypto unavailable (secure context required)");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return new Uint8Array(sig);
  }
  const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
  const toB64 = b => btoa(String.fromCharCode(...b));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function fetchJSON(url, opts) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {}));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.msg || data.error || data.errorMsg || ("HTTP " + res.status));
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------- rounding ---------- */
  function floorToStep(v, step) {
    if (!step || step <= 0) return v;
    const n = Math.floor(v / step + 1e-9);
    return parseFloat((n * step).toPrecision(15));
  }
  function floorToDec(v, dec) {
    const m = Math.pow(10, dec);
    return Math.floor(v * m + 1e-9) / m;
  }

  /* ---------- Binance ---------- */
  const binBase = c => (c && c.testnet ? "https://testnet.binance.vision" : "https://api.binance.com");

  async function binanceReq(creds, method, path, params) {
    const p = Object.assign({}, params);
    p.timestamp = Date.now();
    p.recvWindow = 5000;
    const qs = Object.entries(p).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
    const sig = toHex(await hmac(creds.secret, qs));
    const data = await fetchJSON(binBase(creds) + path + "?" + qs + "&signature=" + sig, {
      method,
      headers: { "X-MBX-APIKEY": creds.key },
    });
    if (typeof data.code === "number" && data.code < 0) throw new Error(data.msg || "Binance error " + data.code);
    return data;
  }

  const binSymCache = {};
  async function binanceSymbolInfo(symbol) { // "BTCUSDT"
    if (binSymCache[symbol]) return binSymCache[symbol];
    const data = await fetchJSON(binBase(getCreds().binance) + "/api/v3/exchangeInfo?symbol=" + symbol);
    const s = (data.symbols || []).find(x => x.symbol === symbol);
    if (!s) throw new Error("Symbol " + symbol + " not found on Binance");
    const lot = s.filters.find(f => f.type === "LOT_SIZE");
    const notional = s.filters.find(f => f.type === "NOTIONAL" || f.type === "MIN_NOTIONAL");
    binSymCache[symbol] = {
      step: parseFloat(lot ? lot.stepSize : "0.000001"),
      minQty: parseFloat(lot ? lot.minQuantity : "0"),
      minNotional: parseFloat(notional ? (notional.value || notional.minNotional) : "5"),
    };
    return binSymCache[symbol];
  }

  /* ---------- KuCoin ---------- */
  const KC_BASE = "https://api.kucoin.com";

  async function kucoinReq(creds, method, path, bodyObj) {
    const ts = (Date.now() / 1000).toFixed(3);
    const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
    const msg = ts + method + path + bodyStr;
    const sig = toB64(await hmac(creds.secret, msg));
    const data = await fetchJSON(KC_BASE + path, {
      method,
      headers: {
        "KC-API-KEY": creds.key,
        "KC-API-SIGN": sig,
        "KC-API-TIMESTAMP": ts,
        "KC-API-ACCESS-KEY": creds.passphrase,
        "Content-Type": "application/json",
      },
      body: bodyStr || undefined,
    });
    if (String(data.code) !== "200000") throw new Error(data.msg || "KuCoin error " + data.code);
    return data.data;
  }

  const kcSymCache = {};
  async function kucoinSymbolInfo(symbol) { // "BTC-USDT"
    if (kcSymCache[symbol]) return kcSymCache[symbol];
    const data = await fetchJSON(KC_BASE + "/api/v1/symbols");
    const s = (data.data || []).find(x => x.symbol === symbol);
    if (!s) throw new Error("Symbol " + symbol + " not found on KuCoin");
    kcSymCache[symbol] = { prec: s.sizePrecision, minSize: parseFloat(s.minSize) };
    return kcSymCache[symbol];
  }

  /* ---------- public API ---------- */

  /* Test a saved credential pair; stores free balances on success. */
  async function testConnection(exId) {
    const creds = getCreds()[exId];
    if (!creds || !creds.key || !creds.secret) throw new Error("Enter API key and secret first");
    let balances = {};
    if (exId === "binance") {
      const data = await binanceReq(creds, "GET", "/api/v3/account", {});
      for (const b of data.balances || []) if (parseFloat(b.free) > 0) balances[b.asset] = parseFloat(b.free);
    } else if (exId === "kucoin") {
      const data = await kucoinReq(creds, "GET", "/api/v1/accounts");
      for (const b of data || []) if (parseFloat(b.available) > 0) balances[b.currency] = parseFloat(b.available);
    } else throw new Error("unsupported exchange");
    state.connected[exId] = true;
    state.balances[exId] = balances;
    return "Connected · USDT free: " + (balances.USDT || 0).toFixed(2);
  }

  function markFailed(exId) {
    state.connected[exId] = false;
  }

  /* Place a real market order.
   * BUY: spend `amountUsdt` (quote). SELL: sell `qty` (base).
   * Returns { qty, quote, orderId } of the filled amount. */
  async function placeMarketOrder(exId, { side, symbol, amountUsdt, qty, price }) {
    const creds = getCreds()[exId];
    if (!creds || !creds.key || !creds.secret) throw new Error(exId + ": no API credentials");

    if (exId === "binance") {
      const exSym = symbol.replace("/", "");
      const info = await binanceSymbolInfo(exSym);
      let q;
      if (side === "BUY") {
        if (!price || price <= 0) throw new Error("price required for BUY sizing");
        q = floorToStep(amountUsdt / price, info.step);
        if (q * price < info.minNotional) throw new Error("below Binance min notional (" + info.minNotional + " USDT)");
      } else {
        q = floorToStep(qty, info.step);
      }
      if (q <= 0 || q < info.minQty) throw new Error("quantity below Binance minimum (" + info.minQty + ")");
      const data = await binanceReq(creds, "POST", "/api/v3/order", {
        symbol: exSym, side: side.toLowerCase(), type: "MARKET", quantity: String(q),
      });
      let filled = parseFloat(data.executedQty || 0);
      let quote = parseFloat(data.cummulativeQuoteQty || 0);
      if (filled <= 0) {
        await sleep(700);
        const st = await binanceReq(creds, "GET", "/api/v3/order", { symbol: exSym, orderId: data.orderId });
        filled = parseFloat(st.executedQty || 0);
        quote = parseFloat(st.cummulativeQuoteQty || 0);
      }
      if (filled <= 0) throw new Error("Binance order not filled");
      return { qty: filled, quote, orderId: data.orderId };
    }

    if (exId === "kucoin") {
      const exSym = symbol.replace("/", "-");
      const info = await kucoinSymbolInfo(exSym);
      let size;
      if (side === "BUY") size = floorToDec(amountUsdt, 2); // market buy size = quote
      else size = floorToDec(qty, info.prec);                // market sell size = base
      if (size <= 0 || size < info.minSize) throw new Error("size below KuCoin minimum (" + info.minSize + ")");
      const clientOid = "arb" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      const data = await kucoinReq(creds, "POST", "/api/v1/orders", {
        clientOid, side: side.toLowerCase(), symbol: exSym, type: "market", size: String(size),
      });
      let filled = 0, quote = 0;
      for (let i = 0; i < 4; i++) {
        await sleep(600);
        const st = await kucoinReq(creds, "GET", "/api/v1/orders/" + data.orderId);
        filled = parseFloat(st.dealSize || 0);
        quote = parseFloat(st.dealValue || 0);
        if (filled > 0) break;
      }
      if (filled <= 0) throw new Error("KuCoin order not filled");
      return { qty: filled, quote, orderId: data.orderId };
    }

    throw new Error("exchange not supported for real trading");
  }

  function setEnabled(on) {
    state.enabled = !!on && state.connected.binance && state.connected.kucoin;
    return state.enabled;
  }

  return { state, supported, getCreds, saveCreds, testConnection, markFailed, placeMarketOrder, setEnabled };
})();
