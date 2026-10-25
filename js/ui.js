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
    rtStatusBin: $("rt-status-bin"),
    rtStatusKc: $("rt-status-kc"),
    rtEnable: $("rt-enable"),
    rtBalance: $("rt-balance"),
    rtHint: $("rt-hint"),
  };

  const fmtMoney = v =>
    (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = v => (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  const fmtPrice = p =>
    p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : p >= 10 ? p.toFixed(2)
    : p.toFixed(4);

  let boardBuilt = false;
  let oppRows = {};   // symbol -> row element
  let liveItems = {}; // exId -> row element
  let lastTradeId = 0;
  let currentMode = "sim";

  /* ---------- mode toggle + live feed strip ---------- */
  let onMode = () => {};
  function setModeHandler(fn) { onMode = fn; }

  function setMode(m) {
    currentMode = m;
    els.modeSim.classList.toggle("active", m === "sim");
    els.modeLive.classList.toggle("active", m === "live");
    els.liveStrip.hidden = (m !== "live");
    els.paperBadge.hidden = (m !== "live");
  }

  function buildLiveStrip(cfg) {
    let html = "";
    for (const e of cfg.exchanges) {
      html += `<div class="live-ex" data-ex="${e.id}"><span class="dot"></span><b>${e.name}</b><span class="live-ts">waiting…</span></div>`;
    }
    els.liveStrip.innerHTML = html;
    els.liveStrip.querySelectorAll(".live-ex").forEach(row => {
      liveItems[row.dataset.ex] = row;
    });
  }

  function renderLive() {
    if (currentMode !== "live" || typeof LiveFeed === "undefined") return;
    for (const [exId, row] of Object.entries(liveItems)) {
      const st = LiveFeed.status[exId];
      if (!st) continue;
      row.classList.toggle("ok", st.ok);
      row.classList.toggle("err", !st.ok);
      const ts = row.querySelector(".live-ts");
      if (st.ts) {
        ts.textContent = new Date(st.ts).toLocaleTimeString("en-GB");
        if (st.error) ts.textContent += " · " + st.error;
      } else {
        ts.textContent = st.error ? st.error : "waiting…";
      }
    }
  }

  /* ---------- price board ---------- */
  function buildBoard(cfg) {
    let html = "<table><thead><tr><th>Pair</th>";
    for (const e of cfg.exchanges) html += `<th>${e.name}<br><span style="opacity:.7">${(e.fee * 100).toFixed(2)}%</span></th>`;
    html += "</tr></thead><tbody>";
    for (const s of cfg.symbols) {
      html += `<tr><td class="sym">${s.id}</td>`;
      for (const e of cfg.exchanges) {
        html += `<td><span class="cell" data-sym="${s.id}" data-ex="${e.id}"></span></td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    els.board.innerHTML = html;
    boardBuilt = true;
  }

  function renderBoard(market, marks) {
    if (!boardBuilt) return;
    const cells = els.board.querySelectorAll(".cell");
    cells.forEach(c => {
      const cell = market.cells[c.dataset.sym][c.dataset.ex];
      const mark = marks[c.dataset.sym];
      const up = cell.price >= cell.prev;
      const d = cell.prev ? ((cell.price - cell.prev) / cell.prev) * 100 : 0;

      let cls = "cell";
      if (mark) {
        if (c.dataset.ex === mark.buyExId) cls += " is-buy";
        if (c.dataset.ex === mark.sellExId) cls += " is-sell";
      }
      cls += up ? " flash-up" : " flash-down";

      c.className = cls;
      c.innerHTML = `${fmtPrice(cell.price)}<span class="delta ${up ? "up" : "down"}">${up ? "▲" : "▼"}${Math.abs(d).toFixed(3)}%</span>`;
    });
  }

  /* ---------- opportunities ---------- */
  function buildOpps(cfg) {
    let html = "";
    for (const s of cfg.symbols) {
      html += `
      <div class="opp" data-sym="${s.id}">
        <div class="opp-top">
          <span class="opp-sym">${s.id}</span>
          <span class="opp-route"></span>
          <span class="opp-net"></span>
        </div>
        <div class="opp-bar"><div class="opp-fill"></div><div class="opp-threshold"></div></div>
        <div class="opp-foot">
          <span class="gross"></span>
          <button class="opp-go">Trade now</button>
        </div>
      </div>`;
    }
    els.opps.innerHTML = html;
    els.opps.querySelectorAll(".opp").forEach(row => {
      oppRows[row.dataset.sym] = row;
      row.querySelector(".opp-go").addEventListener("click", () => onManual(row.dataset.sym));
    });
  }

  function renderOpps(opps, minSpreadPct) {
    els.oppHint.textContent =
      currentMode === "live"
        ? "real prices · net spread after fees"
        : `threshold ${minSpreadPct.toFixed(2)}% net · click “Trade now” to execute manually`;
    const scale = Math.max(1.5, minSpreadPct * 2.2);
    for (const o of opps) {
      const row = oppRows[o.symbol];
      if (!row) continue;
      const hot = o.netPct >= minSpreadPct;
      row.classList.toggle("hot", hot);
      row.querySelector(".opp-route").textContent =
        `buy ${o.buyEx.name} → sell ${o.sellEx.name}`;
      const net = row.querySelector(".opp-net");
      net.textContent = fmtPct(o.netPct);
      net.className = "opp-net " + (o.netPct >= 0 ? "pos" : "neg");
      const fill = row.querySelector(".opp-fill");
      fill.style.width = Math.max(2, Math.min(100, (o.netPct / scale) * 100)) + "%";
      fill.classList.toggle("below", o.netPct < minSpreadPct);
      row.querySelector(".opp-threshold").style.left = Math.min(100, (minSpreadPct / scale) * 100) + "%";
      row.querySelector(".gross").textContent =
        `gross ${fmtPct(o.grossPct)} · fees ${((o.buyEx.fee + o.sellEx.fee) * 100).toFixed(2)}%`;
    }
    // keep list sorted by net spread (DOM order)
    const sorted = opps.map(o => oppRows[o.symbol]);
    sorted.forEach(r => els.opps.appendChild(r));
  }

  /* ---------- trade log ---------- */
  const emptyLogHtml =
    `<div class="log-empty">No trades yet — start the bot or hit “Trade now” on a hot opportunity.</div>`;

  function tradeRow(t) {
    const cls = t.pnl >= 0 ? "pos" : "neg";
    const failed = t.real && t.realStatus && t.realStatus.startsWith("FAILED");
    const realTag = t.real
      ? `<span class="real-tag ${failed ? "fail" : "ok"}">${t.realStatus || "real"}</span>`
      : "";
    return `
      <div class="trade">
        <span class="trade-time">${t.time.toLocaleTimeString("en-GB")}</span>
        <span class="trade-main"><b>${t.symbol}</b> <span class="trade-route">${t.buyEx} → ${t.sellEx} · ${fmtMoney(t.size)} · ${t.mode}${realTag}</span></span>
        <span class="trade-pnl ${cls}">${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}<small>fees ${t.fees.toFixed(2)}</small></span>
      </div>`;
  }

  function renderLog(portfolio) {
    if (portfolio.trades.some(t => t.real)) {
      // real trades update their fill status asynchronously — re-render fully
      let html = "";
      for (const t of portfolio.trades.slice(0, 60)) html += tradeRow(t);
      els.log.innerHTML = html || emptyLogHtml;
      lastTradeId = Math.max(lastTradeId, ...portfolio.trades.map(t => t.id));
    } else {
      const fresh = portfolio.trades.filter(t => t.id > lastTradeId);
      if (fresh.length) {
        for (const t of fresh) els.log.insertAdjacentHTML("afterbegin", tradeRow(t));
        lastTradeId = Math.max(lastTradeId, ...fresh.map(t => t.id));
        while (els.log.children.length > 60) els.log.lastChild.remove();
      }
      if (!portfolio.trades.length) els.log.innerHTML = emptyLogHtml;
    }
    els.logCount.textContent = portfolio.trades.length + " trades";
  }

  /* ---------- stats ---------- */
  function renderStats(portfolio) {
    els.balance.textContent = fmtMoney(portfolio.balance);
    els.pnl.textContent = (portfolio.realized >= 0 ? "+" : "-") + "$" + Math.abs(portfolio.realized).toFixed(2);
    els.pnl.className = portfolio.realized > 0 ? "pos" : portfolio.realized < 0 ? "neg" : "";
    els.roi.textContent = fmtPct(portfolio.roiPct);
    els.roi.className = portfolio.roiPct > 0 ? "pos" : portfolio.roiPct < 0 ? "neg" : "";
    els.trades.textContent = String(portfolio.trades.length);
    els.winrate.textContent = portfolio.winRate === null ? "—" : portfolio.winRate.toFixed(0) + "%";
    els.fees.textContent = fmtMoney(portfolio.fees);
    els.best.textContent = portfolio.best === null ? "—" : "+" + portfolio.best.toFixed(2);
    els.best.className = "pos";
    els.worst.textContent = portfolio.worst === null ? "—" : portfolio.worst.toFixed(2);
    els.worst.className = "neg";
    els.oppcount.textContent = String(portfolio.oppSeen);
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

    els.rtEnable.addEventListener("change", e => {
      ExchangeAPI.setEnabled(e.target.checked);
    });
  }

  function renderReal() {
    const s = ExchangeAPI.state;
    const canArm = currentMode === "live" && s.connected.binance && s.connected.kucoin;
    els.rtEnable.disabled = !canArm && !s.enabled;
    if (!canArm && s.enabled) els.rtEnable.checked = false;
    els.rtHint.textContent = s.enabled
      ? "ARMED — real orders will be placed"
      : canArm
        ? "ready — arm to place real orders"
        : "needs LIVE mode + both exchanges connected";

    els.paperBadge.textContent = s.enabled
      ? (currentMode === "live" ? "REAL TRADING" : "REAL · STANDBY")
      : "PAPER TRADING";
    els.paperBadge.classList.toggle("real", s.enabled);
    els.paperBadge.hidden = !(s.enabled || currentMode === "live");

    const bal = exId => {
      const b = s.balances[exId] || {};
      const usdt = (b.USDT || 0).toFixed(2);
      const coins = Object.keys(b).filter(a => a !== "USDT")
        .map(a => a + " " + b[a].toFixed(4)).join(" · ");
      return "USDT " + usdt + (coins ? " · " + coins : "");
    };
    els.rtBalance.textContent =
      "Binance: " + (s.connected.binance ? bal("binance") : "—") +
      "     KuCoin: " + (s.connected.kucoin ? bal("kucoin") : "—");
  }

  /* ---------- wiring ---------- */
  let onManual = () => {};
  function setManualHandler(fn) { onManual = fn; }

  els.modeSim.addEventListener("click", () => onMode("sim"));
  els.modeLive.addEventListener("click", () => onMode("live"));

  function renderAll(market, portfolio, opps, cfg) {
    renderBoard(market, boardMarks(opps));
    renderOpps(opps, minSpread());
    renderLog(portfolio);
    renderStats(portfolio);
    renderLive();
    renderReal();
  }

  function minSpread() {
    return parseFloat(document.getElementById("set-minspread").value);
  }

  function resetLog() {
    lastTradeId = 0;
    els.log.innerHTML = "";
    els.logCount.textContent = "0 trades";
  }

  return {
    buildBoard,
    buildOpps,
    buildLiveStrip,
    buildReal,
    renderAll,
    setManualHandler,
    setModeHandler,
    setMode,
    resetLog,
    els,
  };
})();
