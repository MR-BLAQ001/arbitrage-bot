/* App bootstrap: wires market, bot, portfolio, live feed and UI together. */
(() => {
  const market = new Market(CONFIG);
  const portfolio = new Portfolio(CONFIG.startingBalance);
  const bot = new Bot(portfolio);

  let mode = "sim"; // "sim" | "live"
  let timer = null;
  const tickMs = () => parseInt(document.getElementById("set-speed").value, 10);

  function loop() {
    bot.realArmed = mode === "live" && ExchangeAPI.state.enabled;
    market.tick();
    const opps = bot.step(market, CONFIG);
    UI.renderAll(market, portfolio, opps, CONFIG);
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(loop, tickMs());
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    market.live = (m === "live");
    UI.setMode(m);
    if (m === "live") LiveFeed.start(market);
    else LiveFeed.stop();
    loop(); // re-render immediately with the new mode
  }

  /* ---------- controls ---------- */
  UI.els.btnToggle.addEventListener("click", () => {
    bot.running = !bot.running;
    UI.els.btnToggle.textContent = bot.running ? "⏸ Stop bot" : "▶ Start bot";
    UI.els.btnToggle.classList.toggle("running", bot.running);
  });

  UI.els.btnReset.addEventListener("click", () => {
    portfolio.reset(CONFIG.startingBalance);
    bot.reset();
    UI.els.btnToggle.textContent = "▶ Start bot";
    UI.els.btnToggle.classList.remove("running");
    UI.resetLog();
  });

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
  UI.setManualHandler(symbol => {
    const opps = scanOpportunities(market, CONFIG);
    const opp = opps.find(o => o.symbol === symbol && o.netPct >= bot.minSpreadPct);
    if (opp) bot.manualTrade(opp);
  });

  /* ---------- go ---------- */
  UI.buildBoard(CONFIG);
  UI.buildOpps(CONFIG);
  UI.buildLiveStrip(CONFIG);
  UI.buildReal();

// Service worker & install button wiring
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
  loop();          // first render immediately
  startTimer();
})();
