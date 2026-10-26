/* Headless simulation harness: runs the bot's real engine (Market + Bot +
 * Portfolio, exactly as in the browser) with a $10 "demo deposit".
 * Usage: node tools/sim-run.js [ticks] [minSpreadPct]
 */
const fs = require("fs");
const vm = require("vm");

const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON };
vm.createContext(ctx);

const src = [
  "js/config.js",
  "js/market.js",
  "js/arbitrage.js",
  "js/portfolio.js",
  "js/bot.js",
]
  .map(f => fs.readFileSync(f, "utf8"))
  .join("\n") +
  "\n;globalThis.__x = { CONFIG, Market, Portfolio, Bot, scanOpportunities };\n";
vm.runInContext(src, ctx, { filename: "bundle.js" });

const ticks = parseInt(process.argv[2] || "100000", 10);
const minSpread = parseFloat(process.argv[3] || "0.35");

const { CONFIG, Market, Portfolio, Bot } = ctx.__x;
const market = new Market(CONFIG);
const portfolio = new Portfolio(10); // $10 demo deposit
const bot = new Bot(portfolio);
bot.running = true;
bot.autoTrade = true;
bot.minSpreadPct = minSpread;
bot.maxPosition = 5; // $5 per trade (50% of the $10 bankroll)

let peak = 10;
let totalTrades = 0;
let reached20At = null;
bot.onTrade = () => {
  totalTrades++;
  if (reached20At === null && portfolio.balance >= 20) reached20At = bot.tickIndex;
};
const t0 = Date.now();
for (let i = 0; i < ticks; i++) {
  market.tick();
  bot.step(market, CONFIG);
  if (portfolio.balance > peak) peak = portfolio.balance;
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const kept = portfolio.trades; // last 200 trades only (array is capped)
const wins = kept.filter(t => t.pnl > 0).length;
const best = kept.reduce((m, t) => Math.max(m, t.pnl), -Infinity);
const worst = kept.reduce((m, t) => Math.min(m, t.pnl), Infinity);

console.log("=== DEMO RUN: $10 deposit ===");
console.log(`ticks:            ${ticks}  (~${(ticks / 3600).toFixed(1)}h at 1 tick/s)   [ran in ${secs}s]`);
console.log(`min net spread:   ${minSpread}%`);
console.log(`final balance:    $${portfolio.balance.toFixed(4)}`);
console.log(`peak balance:     $${peak.toFixed(4)}`);
console.log(`realized P&L:     $${portfolio.realized.toFixed(4)}  (${((portfolio.realized / 10) * 100).toFixed(2)}%)`);
console.log(`total trades:     ${totalTrades}`);
console.log(`last-200 win rate:${kept.length ? ((wins / kept.length) * 100).toFixed(1) : 0}%`);
console.log(`best trade:       $${isFinite(best) ? best.toFixed(4) : "n/a"}`);
console.log(`worst trade:      $${isFinite(worst) ? worst.toFixed(4) : "n/a"}`);
console.log(`fees paid:        $${portfolio.fees.toFixed(4)}`);
console.log(`reached $20:      ${reached20At !== null ? `YES 🎉 at tick ${reached20At} (~${(reached20At / 3600).toFixed(1)}h in)` : "no"}`);
