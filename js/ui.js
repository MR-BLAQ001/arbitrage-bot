/* All DOM rendering for the arbitrage bot dashboard. */
const UI = (() => {
  const $ = id => document.getElementById(id);

  const els = {
    board: $("board"),
    opps: $("opps"),
    oppHint: $("opp-hint"),
    log: $("log"),
    logCount: $("log-count"),
    balance: $("stat-balance"),
    pnl: $("stat-pnl"),
    roi: $("stat-roi"),
    trades: $("stat-trades"),
    winrate: $("stat-winrate"),
    fees: $("stat-fees"),
    best: $("stat-best"),
    worst: $("stat-worst"),
    oppcount: $("stat-oppcount"),
    btnToggle: $("btn-toggle"),
    btnReset: $("btn-reset"),
    btnInstall: $("btn-install"),
    modeSim: $("mode-sim"),
    modeLive: $("mode-live"),
    liveStrip: $("live-strip"),
    paperBadge: $("paper-badge"),
    livePriceBadge: $("live-price-badge"),
    rtStatusBin: $("rt-status-bin"),
    rtStatusKc: $("rt-status-kc"),
    rtEnable: $("rt-enable"),
    rtBalance: $("rt-balance"),
    rtHint: $("rt-hint"),
    perfModeBadge: $("perf-mode-badge"),
    perfProfit: $("perf-profit"),
    perfRoi: $("perf-roi"),
    perfNetworth: $("perf-networth"),
    perfPeak: $("perf-peak"),
    perfTrades: $("perf-trades"),
    perfWinrate: $("perf-winrate"),
    perfChart: $("perf-chart"),
    logDemo: $("log-demo"),
    logLive: $("log-live"),
    logCountDemo: $("log-count-demo"),
    logCountLive: $("log-count-live"),
    wdAvailable: $("wd-available"),
    wdTotalWithdrawn: $("wd-total-withdrawn"),
    wdNetworth: $("wd-networth"),
    wdList: $("wd-list"),
    searchInput: $("search-pairs"),
  };

  const fmtMoney = v =>
    (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  const fmtPrice = p =>
    p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : p >= 10 ? p.toFixed(2)
    : p.toFixed(4);

  let lastTradeId = 0;
  let onManual = () => {};
  function setManualHandler(fn) { onManual = fn; }

  let onMode = () => {};
  function setModeHandler(fn) { onMode = fn; }

  // wire SIM / LIVE toggle buttons (with fallback if els not yet populated)
  const wireMode = () => {
    if (els.modeSim) els.modeSim.onclick = () => onMode("sim");
    if (els.modeLive) els.modeLive.onclick = () => onMode("live");
  };
  wireMode();
  setTimeout(wireMode, 0);

  // expose current search term (synced from main.js via window.__getSearchTerm)
  function getSearch() {
    if (typeof window.__getSearchTerm === "function") return window.__getSearchTerm();
    return "";
  }

  function setMode(m) {
    els.modeSim.classList.toggle("active", m === "sim");
    els.modeLive.classList.toggle("active", m === "live");
    // Both demo and live now use real market prices from the exchanges
    els.livePriceBadge.hidden = false;
    els.liveStrip.hidden = false; // show exchange connection status in both modes
    els.paperBadge.hidden = (m === "live"); // PAPER badge only in demo mode
  }

  function buildLiveStrip(cfg) {
    let html = "";
    for (const e of cfg.exchanges) {
      html += `<div class="live-ex" data-ex="${e.id}"><span class="dot"></span><b>${e.name}</b><span class="live-ts">—</span></div>`;
    }
    els.liveStrip.innerHTML = html;
    els.liveStrip.querySelectorAll(".live-ex").forEach(row => {
      row.querySelector(".dot").classList.add("ok");
      row.querySelector(".live-ts").textContent = "live";
    });
  }

  function renderLive() {
    const st = LiveFeed.status;
    for (const exId of Object.keys(st)) {
      const row = els.liveStrip.querySelector(`.live-ex[data-ex="${exId}"]`);
      if (!row) continue;
      const s = st[exId];
      row.classList.toggle("ok", s.ok);
      row.classList.toggle("err", !s.ok && s.ts);
      row.querySelector(".live-ts").textContent = s.ok ? new Date(s.ts).toLocaleTimeString("en-GB") : (s.error || "—");
    }
  }

  function buildBoard(cfg) {
    const ths = cfg.exchanges.map(e => `<th>${e.name}</th>`).join("");
    const rows = cfg.symbols.map(s => `
      <tr data-symbol="${s.id}">
        <td class="symbol">${s.id}</td>
        ${cfg.exchanges.map(e => `<td class="cell" data-ex="${e.id}"><span class="price">—</span></td>`).join("")}
      </tr>`).join("");
    els.board.innerHTML = `<table><thead><tr><th>Pair</th>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderBoard(market, marks) {
    for (const sym of Object.keys(market.cells)) {
      const row = els.board.querySelector(`tr[data-symbol="${sym}"]`);
      if (!row) continue;
      row.style.display = "";
      for (const exId of Object.keys(market.cells[sym])) {
        const cell = row.querySelector(`td.cell[data-ex="${exId}"]`);
        const c = market.cells[sym][exId];
        cell.querySelector(".price").textContent = fmtPrice(c.price);
        cell.classList.toggle("up", c.price > c.prev);
        cell.classList.toggle("down", c.price < c.prev);
      }
    }
    // marks for best/worst
    for (const m of marks) {
      const row = els.board.querySelector(`tr[data-symbol="${m.symbol}"]`);
      if (!row) continue;
      const buyCell = row.querySelector(`td.cell[data-ex="${m.buyExId}"]`);
      const sellCell = row.querySelector(`td.cell[data-ex="${m.sellExId}"]`);
      if (buyCell) buyCell.classList.add("best");
      if (sellCell) sellCell.classList.add("worst");
    }
  }

  function buildOpps(cfg) {
    els.opps.innerHTML = cfg.symbols.map(s => `
      <div class="opp" data-symbol="${s.id}">
        <div class="opp-head"><b>${s.id}</b><span class="opp-gross">—</span><span class="opp-net">—</span></div>
        <div class="opp-bar"><div class="opp-fill"></div><div class="opp-threshold"></div></div>
        <div class="opp-actions"><button class="btn small trade-btn">Trade now</button></div>
      </div>`).join("");
    els.opps.querySelectorAll(".trade-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const oppEl = btn.closest(".opp");
        onManual(oppEl.dataset.symbol, false);
      });
    });
  }

  function renderOpps(opps, minSpreadPct) {
    const maxScale = Math.max(1.0, ...opps.map(o => o.netPct));
    for (const o of opps) {
      const row = els.opps.querySelector(`.opp[data-symbol="${o.symbol}"]`);
      if (!row) continue;
      row.style.display = "";
      row.querySelector(".opp-gross").textContent = fmtPct(o.grossPct);
      row.querySelector(".opp-net").textContent = fmtPct(o.netPct);
      row.querySelector(".opp-net").classList.toggle("hot", o.netPct >= minSpreadPct);
      const fill = row.querySelector(".opp-fill");
      fill.style.width = (o.netPct / maxScale * 100) + "%";
      fill.classList.toggle("hot", o.netPct >= minSpreadPct);
      row.querySelector(".opp-threshold").style.left = (minSpreadPct / maxScale * 100) + "%";
    }
    const count = opps.length;
    els.oppHint.textContent = `net spread after fees · threshold ${minSpreadPct.toFixed(2)}% · ${count} match${count === 1 ? "" : "es"}`;
  }

  const emptyLogHtml = '<div class="empty-log">No trades yet</div>';

  function tradeRow(t) {
    const realTag = t.real ? ` <span class="chip ${t.realStatus && t.realStatus.includes("FAILED") ? "chip-sell" : "chip-buy"}">${t.realStatus ? "REAL" : "real"}</span>` : "";
    const cls = t.pnl > 0 ? "pos" : t.pnl < 0 ? "neg" : "";
    return `
      <div class="trade">
        <span class="trade-time">${new Date(t.time).toLocaleTimeString("en-GB")}</span>
        <span class="trade-main"><b>${t.symbol}</b> <span class="trade-route">${t.buyEx} → ${t.sellEx} · ${fmtMoney(t.size)} · ${t.mode}${realTag}</span></span>
        <span class="trade-pnl ${cls}">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}<small>fees ${t.fees.toFixed(2)}</small></span>
      </div>`;
  }

  // separate lastTradeId trackers for demo and live
  let lastDemoTradeId = 0;
  let lastLiveTradeId = 0;

  function renderLogDemo(accounts) {
    const state = accounts.getDemo();
    const trades = state.trades;
    if (lastDemoTradeId === 0) {
      els.logDemo.innerHTML = trades.length ? trades.map(tradeRow).reverse().join("") : emptyLogHtml;
      lastDemoTradeId = trades.length ? trades[trades.length - 1].id : 0;
    } else {
      const fresh = trades.filter(t => t.id > lastDemoTradeId);
      if (fresh.length) {
        for (const t of fresh) els.logDemo.insertAdjacentHTML("afterbegin", tradeRow(t));
        lastDemoTradeId = Math.max(lastDemoTradeId, ...fresh.map(t => t.id));
        while (els.logDemo.children.length > 60) els.logDemo.lastChild.remove();
      }
    }
    els.logCountDemo.textContent = trades.length + " trades";
  }

  function renderLogLive(accounts) {
    const state = accounts.getLive();
    const trades = state.trades;
    if (lastLiveTradeId === 0) {
      els.logLive.innerHTML = trades.length ? trades.map(tradeRow).reverse().join("") : emptyLogHtml;
      lastLiveTradeId = trades.length ? trades[trades.length - 1].id : 0;
    } else {
      const fresh = trades.filter(t => t.id > lastLiveTradeId);
      if (fresh.length) {
        for (const t of fresh) els.logLive.insertAdjacentHTML("afterbegin", tradeRow(t));
        lastLiveTradeId = Math.max(lastLiveTradeId, ...fresh.map(t => t.id));
        while (els.logLive.children.length > 60) els.logLive.lastChild.remove();
      }
    }
    els.logCountLive.textContent = trades.length + " trades";
  }

  function renderStats(accounts, mode) {
    const state = mode === "sim" ? accounts.getDemo() : accounts.getLive();
    const bal = mode === "sim" ? state.balance : (state.balance !== null ? state.balance : NaN);
    if (els.balance) els.balance.textContent = isFinite(bal) ? fmtMoney(bal) : "—";
    if (els.pnl) {
      els.pnl.textContent = (state.realized >= 0 ? "+" : "-") + "$" + Math.abs(state.realized).toFixed(2);
      els.pnl.className = state.realized > 0 ? "pos" : state.realized < 0 ? "neg" : "";
    }
    const roi = state.starting ? (state.realized / state.starting) * 100 : 0;
    if (els.roi) {
      els.roi.textContent = fmtPct(roi);
      els.roi.className = roi > 0 ? "pos" : roi < 0 ? "neg" : "";
    }
    const trades = state.trades;
    if (els.trades) els.trades.textContent = String(trades.length);
    const wr = state.tradesTotal ? (state.winsTotal / state.tradesTotal) * 100 : null;
    if (els.winrate) els.winrate.textContent = wr === null ? "—" : wr.toFixed(0) + "%";
    if (els.fees) els.fees.textContent = fmtMoney(state.fees);
    const best = trades.length ? Math.max(...trades.map(t => t.pnl)) : null;
    const worst = trades.length ? Math.min(...trades.map(t => t.pnl)) : null;
    if (els.best) { els.best.textContent = best === null ? "—" : "+" + best.toFixed(2); els.best.className = "pos"; }
    if (els.worst) { els.worst.textContent = worst === null ? "—" : worst.toFixed(2); els.worst.className = "neg"; }
    if (els.oppcount) els.oppcount.textContent = String(state.oppSeen || 0);
  }

  function renderPerformance(accounts, mode) {
    const state = mode === "sim" ? accounts.getDemo() : accounts.getLive();
    // update the mode badge
    const badge = els.perfModeBadge;
    if (badge) {
      badge.textContent = mode === "sim" ? "DEMO" : "LIVE";
      badge.className = mode === "sim" ? "chip chip-buy" : "chip chip-sell";
    }
    // stats
    if (els.perfProfit) els.perfProfit.textContent = (state.realized >= 0 ? "+" : "-") + fmtMoney(Math.abs(state.realized));
    if (els.perfRoi) els.perfRoi.textContent = fmtPct(state.starting ? (state.realized / state.starting) * 100 : 0);
    if (els.perfNetworth) els.perfNetworth.textContent = fmtMoney(state.balance + state.totalWithdrawn);
    if (els.perfPeak) els.perfPeak.textContent = state.peakBalance ? fmtMoney(state.peakBalance) : "—";
    if (els.perfTrades) els.perfTrades.textContent = String(state.tradesTotal);
    if (els.perfWinrate) els.perfWinrate.textContent = state.tradesTotal ? ((state.winsTotal / state.tradesTotal) * 100).toFixed(1) + "%" : "—";
    // equity chart
    if (els.perfChart) drawEquity(els.perfChart, state.equity, state.starting);
  }

  function renderWithdrawals(accounts) {
    // ONLY live account data — withdrawals are from real trades only
    const live = accounts.getLive ? accounts.getLive() : { balance: null, totalWithdrawn: 0, withdrawals: [] };
    const bal = live.balance !== null && live.balance !== undefined ? live.balance : 0;
    if (els.wdAvailable) els.wdAvailable.textContent = fmtMoney(bal);
    if (els.wdTotalWithdrawn) els.wdTotalWithdrawn.textContent = fmtMoney(live.totalWithdrawn || 0);
    if (els.wdNetworth) els.wdNetworth.textContent = fmtMoney(bal + (live.totalWithdrawn || 0));
    // withdrawal history
    if (els.wdList) {
      const html = (live.withdrawals || []).map(w => `
        <div class="wd-item"><span>${w.time ? new Date(w.time).toLocaleString() : ""}</span><b>${fmtMoney(w.amount)}</b><span class="${w.status}">${w.status}</span></div>
      `).join("");
      els.wdList.innerHTML = html || "<div class='empty'>No withdrawals yet</div>";
    }
  }

  function drawEquity(canvas, data, starting) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    const h = canvas.height = 200 * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    if (!data || data.length < 2) return;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    ctx.beginPath();
    ctx.moveTo(0, h - (data[0] - min) / range * h);
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(i / (data.length - 1) * w, h - (data[i] - min) / range * h);
    }
    ctx.strokeStyle = data[data.length - 1] >= starting ? "#2fd48a" : "#f4636e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* ---------- real trading ---------- */
  function buildReal() {
    const creds = ExchangeAPI.getCreds();
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    setVal("rt-bin-key", creds.binance && creds.binance.key);
    setVal("rt-bin-secret", creds.binance && creds.binance.secret);
    if (creds.binance) document.getElementById("rt-bin-testnet").checked = !!creds.binance.testnet;
    setVal("rt-kc-key", creds.kucoin && creds.kucoin.key);
    setVal("rt-kc-secret", creds.kucoin && creds.kucoin.secret);
    setVal("rt-kc-pass", creds.kucoin && creds.kucoin.passphrase);

    const wireTest = (exId, keyId, secretId, passId, testId, statusId) => {
      document.getElementById(testId).addEventListener("click", async () => {
        const c = ExchangeAPI.getCreds();
        const entry = {
          key: document.getElementById(keyId).value.trim(),
          secret: document.getElementById(secretId).value.trim(),
        };
        if (passId) entry.passphrase = document.getElementById(passId).value.trim();
        if (exId === "binance") entry.testnet = document.getElementById("rt-bin-testnet").checked;
        c[exId] = entry;
        ExchangeAPI.saveCreds(c);

        const st = document.getElementById(statusId);
        st.textContent = "testing…";
        st.className = "rt-status";
        try {
          const detail = await ExchangeAPI.testConnection(exId);
          st.textContent = detail;
          st.className = "rt-status ok";
        } catch (e) {
          ExchangeAPI.markFailed(exId);
          st.textContent = e.message || String(e);
          st.className = "rt-status err";
        }
      });
    };
    wireTest("binance", "rt-bin-key", "rt-bin-secret", null, "rt-test-bin", "rt-status-bin");
    wireTest("kucoin", "rt-kc-key", "rt-kc-secret", "rt-kc-pass", "rt-test-kc", "rt-status-kc");

    els.rtEnable.addEventListener("change", async () => {
      const s = ExchangeAPI.state;
      const canArm = els.modeLive.classList.contains("active") && s.connected.binance && s.connected.kucoin;
      if (!canArm) {
        els.rtEnable.checked = false;
        els.rtHint.textContent = "needs LIVE mode + both exchanges connected";
        return;
      }
      const on = ExchangeAPI.setEnabled(els.rtEnable.checked);
      els.rtEnable.checked = on;
      els.rtHint.textContent = on ? "REAL TRADING ARMED · live market orders will fire" : "Real trading disarmed";
    });
  }

  function renderReal() {
    const s = ExchangeAPI.state;
    const connectedCount = [s.connected.binance, s.connected.kucoin].filter(Boolean).length;
    const canArm = els.modeLive.classList.contains("active") && connectedCount === 2;
    els.rtEnable.disabled = !canArm && !s.enabled;
    els.rtHint.textContent = s.enabled
      ? "REAL TRADING ARMED · live market orders will fire"
      : connectedCount < 2
        ? "needs LIVE mode + both exchanges connected"
        : "Arm to enable real trading";
    const b = s.balances;
    const binUSDT = (b.binance || {}).USDT || 0;
    const kcUSDT = (b.kucoin || {}).USDT || 0;
    els.rtBalance.textContent = `Binance USDT: ${binUSDT.toFixed(2)} · KuCoin USDT: ${kcUSDT.toFixed(2)}`;
  }

  function buildFlashPanel() {
    els.flashPanel = document.querySelector(".flash-panel");
    if (els.flashPanel) els.flashPanel.hidden = false;
  }

  function renderAll(market, accounts, mode, opps, cfg) {
    const minSpread = parseFloat(document.getElementById("set-minspread").value);
    renderBoard(market, boardMarks(opps));
    renderOpps(opps, minSpread);
    renderLogDemo(accounts);
    renderLogLive(accounts);
    renderStats(accounts, mode);
    renderPerformance(accounts, mode);
    renderWithdrawals(accounts);
    renderLive();
    renderReal();
  }

  function boardMarks(opps) {
    return opps.filter(o => o.executable).map(o => ({
      symbol: o.symbol,
      buyExId: o.buyEx.id,
      sellExId: o.sellEx.id,
    }));
  }

  return {
    buildBoard,
    buildOpps,
    buildLiveStrip,
    buildReal,
    buildFlashPanel,
    renderAll,
    setManualHandler,
    setModeHandler,
    getSearch,
    setMode,
    wireModeToggle: wireMode,
    resetLog: () => {
      lastDemoTradeId = 0;
      lastLiveTradeId = 0;
      if (els.logDemo) els.logDemo.innerHTML = emptyLogHtml;
      if (els.logLive) els.logLive.innerHTML = emptyLogHtml;
      if (els.logCountDemo) els.logCountDemo.textContent = "0 trades";
      if (els.logCountLive) els.logCountLive.textContent = "0 trades";
    },
    els,
  };
})();