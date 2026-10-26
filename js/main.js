/* App bootstrap: wires market, bot, accounts, live feed and UI together. */
(() => {
  const market = new Market(CONFIG);
  const accounts = Accounts.init(); // { demo, live }
  const bot = new Bot(accounts);    // bot now uses accounts instead of a single portfolio

  let mode = "sim"; // "sim" | "live"
  let searchTerm = ""; // filters board + opportunities
  let timer = null;

  // expose search term setter so nav.js can update it when the nav search input changes
  window.__setSearchTerm = term => {
    searchTerm = (term || "").toLowerCase();
    // re-render immediately with filtered results
    const opps = scanOpportunities(market, CONFIG, searchTerm);
    UI.renderAll(market, accounts, mode, opps, CONFIG);
  };
  const tickMs = () => parseInt(document.getElementById("set-speed").value, 10);

  let loopCount = 0;
  function loop() {
    bot.realArmed = mode === "live" && ExchangeAPI.state.enabled;
    market.tick();
    const opps = scanOpportunities(market, CONFIG, searchTerm);
    if (++loopCount % 5 === 0) {
      if (mode === "sim") accounts.demoSnapshot();
    }
    UI.renderAll(market, accounts, mode, opps, CONFIG);
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(loop, tickMs());
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    // Always use real live market prices for both demo and live modes.
    // The only difference between demo and live is the account balance
    // (simulated $10k vs real exchange balance) and whether real orders
    // are placed.
    market.live = true;
    UI.setMode(m);
    LiveFeed.start(market);
    if (m === "live") {
      Accounts.startAutoRefresh();
      Accounts.refreshLiveBalance(); // fetch balance immediately
    } else {
      Accounts.stopAutoRefresh();
    }
    loop(); // re-render immediately with the new mode
  }

  /* ---------- controls ---------- */
  UI.els.btnToggle.addEventListener("click", () => {
    bot.running = !bot.running;
    UI.els.btnToggle.textContent = bot.running ? "⏸ Stop bot" : "▶ Start bot";
    UI.els.btnToggle.classList.toggle("running", bot.running);
  });

  UI.els.btnReset.addEventListener("click", () => {
    if (!confirm("Reset demo account? This will erase all demo trades and restore the $10,000 balance.")) return;
    accounts.resetDemo();
    bot.reset();
    UI.els.btnToggle.textContent = "▶ Start bot";
    UI.els.btnToggle.classList.remove("running");
    UI.resetLog();
    const wdMsg = document.getElementById("wd-msg");
    if (wdMsg) { wdMsg.textContent = ""; wdMsg.className = "wd-msg"; }
  });

  /* ---------- withdrawals (demo vs live) ---------- */
  const wdAmount = document.getElementById("wd-amount");
  const wdBtn = document.getElementById("wd-btn");
  const wdMsg = document.getElementById("wd-msg");
  const doWithdraw = () => {
    const amt = parseFloat(wdAmount.value);
    let res;
    if (mode === "sim") {
      res = accounts.demoWithdraw(amt);
      if (res.ok) {
        wdMsg.textContent = "Withdrawn $" + res.w.amount.toFixed(2) + " · demo balance now " + accounts.getDemo().balance.toFixed(2);
        wdMsg.className = "wd-msg ok";
        wdAmount.value = "";
      } else {
        wdMsg.textContent = res.error;
        wdMsg.className = "wd-msg err";
      }
    } else {
      // Live withdrawal: mark as pending, do not deduct yet
      res = accounts.liveWithdraw(amt, 'pending');
      if (res.ok) {
        wdMsg.textContent = "Withdrawal submitted (pending confirmation).";
        wdMsg.className = "wd-msg ok";
        wdAmount.value = "";
        // In a real implementation, you'd call the exchange API here
        // and then confirmWithdraw or failWithdraw based on the result.
      } else {
        wdMsg.textContent = res.error;
        wdMsg.className = "wd-msg err";
      }
    }
    UI.renderAll(market, accounts, mode, scanOpportunities(market, CONFIG), CONFIG);
  };
  wdBtn.addEventListener("click", doWithdraw);
  wdAmount.addEventListener("keydown", e => { if (e.key === "Enter") doWithdraw(); });

  UI.setModeHandler(setMode);

  const bind = (id, labelId, fmt) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      document.getElementById(labelId).textContent = fmt(el.value);
      if (id === "set-speed") startTimer();
    });
  };
  bind("set-minspread", "val-minspread", v => parseFloat(v).toFixed(2) + "%");
  bind("set-maxpos", "val-maxpos", v => "$" + parseInt(v, 10).toLocaleString());
  bind("set-speed", "val-speed", v => (parseInt(v, 10) / 1000).toFixed(1) + "s");

  document.getElementById("set-autotrade").addEventListener("change", e => {
    bot.autoTrade = e.target.checked;
  });

  // manual "Trade now" buttons
  UI.setManualHandler((symbol, isLive) => {
    const opps = scanOpportunities(market, CONFIG, searchTerm);
    const opp = opps.find(o => o.symbol === symbol && o.netPct >= bot.minSpreadPct);
    if (opp) bot.manualTrade(opp, isLive);
  });

  // ---------- flash‑loan (real DEX arbitrage) ----------
  const $f = id => document.getElementById(id);
  const flashStatus = $f("flash-status");
  const flashExecBtn = $f("flash-exec");
  const flashStartBtn = $f("flash-start");
  const flashStopBtn = $f("flash-stop");
  const flashSetupBtn = $f("flash-setup");
  if (flashExecBtn && flashStartBtn && flashStopBtn) {
    const flCfg = CONFIG.flashLoanReceiver;
    if (flCfg.address && flCfg.address !== "0x…") $f("flash-receiver").value = flCfg.address;
    if (flCfg.routerA && flCfg.routerA !== "0x…") $f("flash-router-a").value = flCfg.routerA;
    if (flCfg.routerB && flCfg.routerB !== "0x…") $f("flash-router-b").value = flCfg.routerB;
    if (flCfg.defaultAsset) $f("flash-asset").value = flCfg.defaultAsset;
    if (flCfg.defaultIntermediate) $f("flash-intermediate").value = flCfg.defaultIntermediate;

    const setStatus = (msg, kind) => {
      flashStatus.textContent = msg;
      flashStatus.className = "flash-status" + (kind ? " " + kind : "");
    };

    let autoFlashTimer = null;
    let busy = false;

    const readInputs = () => {
      const receiver = $f("flash-receiver").value.trim();
      const routerA = $f("flash-router-a").value.trim();
      const routerB = $f("flash-router-b").value.trim();
      const asset = $f("flash-asset").value.trim();
      const intermediate = $f("flash-intermediate").value.trim();
      const amount = $f("flash-amount").value.trim();
      const slippage = parseInt($f("flash-slippage").value.trim(), 10) || 50;
      return { receiver, routerA, routerB, asset, intermediate, amount, slippage };
    };

    const syncReceiver = () => {
      const { receiver } = readInputs();
      if (receiver.startsWith("0x") && receiver.length === 42) {
        CONFIG.flashLoanReceiver.address = receiver;
        FlashLoan.init();
      }
    };

    flashSetupBtn.addEventListener("click", async () => {
      syncReceiver();
      const { routerA, routerB, slippage } = readInputs();
      if (!routerA || !routerB) return setStatus("Enter both router addresses.", "err");
      setStatus("Connecting routers on-chain…");
      const res = await FlashLoan.setRouters(routerA, routerB, slippage);
      if (res.ok) setStatus("Routers connected (tx " + res.hash.slice(0, 10) + "…). Ready to arbitrage.", "ok");
      else setStatus("Setup failed: " + res.error, "err");
    });

    const runOnce = async () => {
      if (busy) return;
      busy = true;
      syncReceiver();
      const { asset, intermediate, amount } = readInputs();
      if (!asset || !intermediate || !amount || Number(amount) <= 0) {
        setStatus("Enter asset, intermediate token and a positive amount.", "err");
        busy = false;
        return;
      }
      setStatus("Executing arbitrage flash loan…");
      const res = await FlashLoan.request(asset, amount, intermediate);
      if (res.ok) {
        const profit = res.profit ? " · profit " + (Number(res.profit) / 1e18).toFixed(4) : "";
        setStatus("Filled (tx " + res.hash.slice(0, 10) + "…)" + profit, "ok");
      } else {
        setStatus("Reverted (not profitable or bad path): " + res.error, "err");
      }
      busy = false;
    };

    flashExecBtn.addEventListener("click", runOnce);

    const startAutoFlash = () => {
      if (autoFlashTimer) return;
      autoFlashTimer = setInterval(runOnce, 15000);
      flashStartBtn.disabled = true;
      flashStopBtn.disabled = false;
      setStatus("Auto mode: attempting an arbitrage every 15s…", "ok");
    };
    const stopAutoFlash = () => {
      if (autoFlashTimer) clearInterval(autoFlashTimer);
      autoFlashTimer = null;
      flashStartBtn.disabled = false;
      flashStopBtn.disabled = true;
      setStatus("Auto mode stopped.");
    };
    flashStartBtn.addEventListener("click", startAutoFlash);
    flashStopBtn.addEventListener("click", stopAutoFlash);
  }

  /* ---------- go ---------- */
  UI.buildBoard(CONFIG);
  UI.buildOpps(CONFIG);
  UI.buildLiveStrip(CONFIG);
  UI.buildFlashPanel();
  UI.buildReal();
  if (UI.wireModeToggle) UI.wireModeToggle();

  // wire the floating glass nav (switch views, preserve state)
  if (Nav && Nav.setOnActivate) Nav.setOnActivate(view => {
    if (view === "dashboard") {
      // force a fresh equity chart draw now that the canvas is visible
      UI.renderAll(market, accounts, mode, [], CONFIG);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(r => {
      console.log('SW registered', r);
    }).catch(err => console.error('SW register error', err));
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    UI.els.btnInstall.hidden = false;
  });

  UI.els.btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('install outcome:', outcome);
    deferredPrompt = null;
    UI.els.btnInstall.hidden = true;
  });

  UI.setMode("sim");
  loop();
  startTimer();
})();