/* FlashLoan module – REAL DEX-arbitrage flash loan via Aave v3 + your receiver.
 *
 * Flow:
 *   1. (once) setRouters(routerA, routerB) on the receiver
 *   2. initiateFlashLoan(asset, amount, intermediate)
 *        -> borrow `asset` from Aave
 *        -> swap asset -> intermediate on routerA
 *        -> swap intermediate -> asset on routerB
 *        -> repay loan + premium, keep the profit
 *        -> if NOT profitable the whole tx reverts (you only pay gas)
 *
 * You must deploy contracts/FlashLoanReceiver.sol and put its address + the
 * Aave pool + the two DEX routers into CONFIG.flashLoanReceiver.
 */
const FlashLoan = (() => {
  const { ethers } = window;
  const cfg = CONFIG.flashLoanReceiver;
  let provider;
  let signer;
  let contract;

  function init() {
    if (!window.ethereum) {
      console.error("MetaMask not detected");
      return false;
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    if (cfg && cfg.address && cfg.address.startsWith("0x") && cfg.address.length === 42) {
      contract = new ethers.Contract(cfg.address, cfg.abi, signer);
    }
    return !!contract;
  }

  function ready() {
    if (!contract) init();
    return !!contract;
  }

  /* One-time setup: point the receiver at the two DEX routers. */
  async function setRouters(routerA, routerB, slippageBps) {
    if (!ready()) return { ok: false, error: "MetaMask or receiver not configured" };
    try {
      const tx = await contract.setRouters(routerA, routerB);
      await tx.wait();
      let slippageTx = null;
      if (slippageBps) {
        slippageTx = await contract.setSlippage(slippageBps);
        await slippageTx.wait();
      }
      return { ok: true, hash: tx.hash };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* Read back the on-chain config so the UI can show what's live. */
  async function getConfig() {
    if (!ready()) return null;
    try {
      return {
        pool: await contract.pool(),
        owner: await contract.owner(),
        routerA: await contract.routerA(),
        routerB: await contract.routerB(),
        slippageBps: (await contract.slippageBps()).toString(),
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  /* Run one real arbitrage flash loan. Returns a detailed status object. */
  async function request(asset, amount, intermediate) {
    if (!ready()) return { ok: false, error: "MetaMask or receiver not configured" };
    const amt = ethers.utils.parseUnits(amount.toString(), 18);
    try {
      const tx = await contract.initiateFlashLoan(asset, amt, intermediate);
      console.log("Flash loan tx sent", tx.hash);
      const receipt = await tx.wait();
      // Try to read the ArbitrageExecuted event for the actual profit.
      let profit = null;
      const iface = new ethers.utils.Interface(cfg.abi);
      for (const log of receipt.logs) {
        try {
          const p = iface.parseLog(log);
          if (p && p.name === "ArbitrageExecuted") {
            profit = p.args.profit.toString();
          }
        } catch (_) { /* not our event */ }
      }
      return { ok: true, hash: tx.hash, profit: profit, gasUsed: receipt.gasUsed.toString() };
    } catch (err) {
      // A revert here usually means "not profitable" (by design) or a bad path.
      return { ok: false, error: err.reason || err.message };
    }
  }

  return { init, ready, setRouters, getConfig, request };
})();
