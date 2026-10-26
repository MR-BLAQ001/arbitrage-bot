/* Account Manager: separates Demo and Live accounts, persists state, fetches live balances.
 * Source of truth:
 *   - Demo: localStorage (simulated, never resets unless user explicitly resets)
 *   - Live: exchange API balances (refreshed on trade, withdrawal, or manual refresh)
 */
const Accounts = (() => {
  const LS_KEY_DEMO = 'arb-bot-demo-v1';
  const LS_KEY_LIVE = 'arb-bot-live-v1';
  const VERSION = 1;

  let demoState = null;
  let liveState = null;
  let refreshTimer = null;

  function defaultDemo() {
    return {
      balance: 10000,
      starting: 10000,
      realized: 0,
      fees: 0,
      trades: [],
      withdrawals: [],
      totalWithdrawn: 0,
      equity: [10000],
      peakBalance: 10000,
      tradesTotal: 0,
      winsTotal: 0,
      lossesTotal: 0,
    };
  }

  function defaultLive() {
    return {
      balance: null,        // fetched from exchange
      realized: 0,
      fees: 0,
      trades: [],
      withdrawals: [],
      totalWithdrawn: 0,
      equity: [],
      peakBalance: null,
      tradesTotal: 0,
      winsTotal: 0,
      lossesTotal: 0,
      lastUpdated: null,
      error: null,
    };
  }

  function loadDemo() {
    try {
      const raw = localStorage.getItem(LS_KEY_DEMO);
      if (!raw) return defaultDemo();
      const data = JSON.parse(raw);
      if (data.version !== VERSION) return defaultDemo();
      return data;
    } catch (e) {
      console.warn('Demo state corrupted, resetting', e);
      return defaultDemo();
    }
  }

  function saveDemo() {
    try {
      localStorage.setItem(LS_KEY_DEMO, JSON.stringify({ ...demoState, version: VERSION }));
    } catch (e) {
      console.warn('Failed to save demo state', e);
    }
  }

  function loadLive() {
    try {
      const raw = localStorage.getItem(LS_KEY_LIVE);
      if (!raw) return defaultLive();
      const data = JSON.parse(raw);
      if (data.version !== VERSION) return defaultLive();
      return data;
    } catch (e) {
      console.warn('Live state corrupted, resetting', e);
      return defaultLive();
    }
  }

  function saveLive() {
    try {
      localStorage.setItem(LS_KEY_LIVE, JSON.stringify({ ...liveState, version: VERSION }));
    } catch (e) {
      console.warn('Failed to save live state', e);
    }
  }

  function init() {
    demoState = loadDemo();
    liveState = loadLive();
    return { getDemo, getLive, resetDemo, demoExecute, demoWithdraw, demoSnapshot, liveExecute, liveWithdraw, confirmWithdraw, failWithdraw, refreshLiveBalance, startAutoRefresh, stopAutoRefresh };
  }

  function getDemo() { return demoState; }
  function getLive() { return liveState; }

  function resetDemo() {
    demoState = defaultDemo();
    saveDemo();
    return demoState;
  }

  /* Demo operations (persisted) */
  function demoExecute(trade) {
    demoState.tradesTotal++;
    if (trade.pnl > 0) demoState.winsTotal++; else demoState.lossesTotal++;
    demoState.balance += trade.pnl;
    demoState.realized += trade.pnl;
    demoState.fees += trade.fees;
    if (demoState.balance > demoState.peakBalance) demoState.peakBalance = demoState.balance;
    trade.id = demoState.tradesTotal;
    trade.time = new Date().toISOString();
    demoState.trades.unshift(trade);
    if (demoState.trades.length > 200) demoState.trades.pop();
    saveDemo();
  }

  function demoWithdraw(amount) {
    amount = Math.floor(amount * 100) / 100;
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount' };
    if (amount > demoState.balance) return { ok: false, error: 'Amount exceeds balance (' + demoState.balance.toFixed(2) + ')' };
    demoState.balance -= amount;
    demoState.totalWithdrawn += amount;
    const w = { id: demoState.withdrawals.length + 1, time: new Date().toISOString(), amount };
    demoState.withdrawals.unshift(w);
    if (demoState.withdrawals.length > 50) demoState.withdrawals.pop();
    saveDemo();
    return { ok: true, w };
  }

  function demoSnapshot() {
    demoState.equity.push(demoState.balance);
    if (demoState.equity.length > 600) demoState.equity.shift();
    saveDemo();
  }

  /* Live operations (balance from exchange, trades/withdrawals persisted) */
  async function refreshLiveBalance() {
    if (!ExchangeAPI || !ExchangeAPI.state.enabled) {
      liveState.error = 'Not connected';
      liveState.balance = null;
      saveLive();
      return liveState;
    }
    try {
      // Fetch balances from connected exchanges
      const balances = ExchangeAPI.state.balances;
      let totalUSDT = 0;
      for (const exId of Object.keys(balances)) {
        const exBal = balances[exId];
        if (exBal && exBal.USDT) totalUSDT += exBal.USDT;
      }
      liveState.balance = totalUSDT > 0 ? totalUSDT : liveState.balance; // keep old if zero
      liveState.lastUpdated = new Date().toISOString();
      liveState.error = null;
      saveLive();
    } catch (e) {
      liveState.error = e.message || 'Balance fetch failed';
      console.warn('Live balance refresh failed', e);
    }
    return liveState;
  }

  function liveExecute(trade) {
    liveState.tradesTotal++;
    if (trade.pnl > 0) liveState.winsTotal++; else liveState.lossesTotal++;
    liveState.realized += trade.pnl;
    liveState.fees += trade.fees;
    trade.id = liveState.tradesTotal;
    trade.time = new Date().toISOString();
    liveState.trades.unshift(trade);
    if (liveState.trades.length > 200) liveState.trades.pop();
    saveLive();
    // Refresh balance after trade (async)
    refreshLiveBalance();
  }

  function liveWithdraw(amount, status = 'pending') {
    amount = Math.floor(amount * 100) / 100;
    if (!isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a valid amount' };
    // For live, we don't deduct immediately; wait for confirmation
    const w = {
      id: liveState.withdrawals.length + 1,
      time: new Date().toISOString(),
      amount,
      status, // 'pending' | 'confirmed' | 'failed'
      txId: null,
    };
    liveState.withdrawals.unshift(w);
    if (liveState.withdrawals.length > 50) liveState.withdrawals.pop();
    saveLive();
    return { ok: true, w };
  }

  function confirmWithdraw(withdrawalId, txId) {
    const w = liveState.withdrawals.find(x => x.id === withdrawalId);
    if (!w) return { ok: false, error: 'Withdrawal not found' };
    if (w.status === 'confirmed') return { ok: false, error: 'Already confirmed' };
    w.status = 'confirmed';
    w.txId = txId;
    liveState.totalWithdrawn += w.amount;
    saveLive();
    refreshLiveBalance();
    return { ok: true };
  }

  function failWithdraw(withdrawalId, reason) {
    const w = liveState.withdrawals.find(x => x.id === withdrawalId);
    if (!w) return { ok: false, error: 'Withdrawal not found' };
    w.status = 'failed';
    w.error = reason;
    saveLive();
    return { ok: true };
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (ExchangeAPI && ExchangeAPI.state.enabled) refreshLiveBalance();
    }, 30000); // every 30s
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  return {
    init,
    getDemo,
    getLive,
    resetDemo,
    demoExecute,
    demoWithdraw,
    demoSnapshot,
    liveExecute,
    liveWithdraw,
    confirmWithdraw,
    failWithdraw,
    refreshLiveBalance,
    startAutoRefresh,
    stopAutoRefresh,
  };
})();