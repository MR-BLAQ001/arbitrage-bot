/* FlashLoan module – uses ethers.js to trigger a flash loan on Aave (Goerli) via a pre‑deployed receiver contract.
 * The user must deploy the receiver contract (Solidity code provided below) and update config with its address.
 */
const FlashLoan = (() => {
  const { ethers } = window;
  const { flashLoanReceiver } = CONFIG;
  let provider;
  let signer;

  function init() {
    if (!window.ethereum) {
      console.error("MetaMask not detected");
      return;
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
  }

  async function request(asset, amount) {
    if (!provider) init();
    if (!flashLoanReceiver || !flashLoanReceiver.address) {
      console.error("FlashLoanReceiver address not configured");
      return false;
    }
    const receiverAddress = flashLoanReceiver.address;
    const abi = flashLoanReceiver.abi;
    const contract = new ethers.Contract(receiverAddress, abi, signer);
    try {
      const tx = await contract.initiateFlashLoan(asset, amount);
      console.log("Flash loan tx sent", tx.hash);
      await tx.wait();
      console.log("Flash loan executed");
      return true;
    } catch (err) {
      console.error("Flash loan failed", err);
      return false;
    }
  }

  return { init, request };
})();