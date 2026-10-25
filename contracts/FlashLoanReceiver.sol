// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IFlashLoanReceiver.sol";
import "@aave/core-v3/contracts/interfaces/IERC20.sol";

contract FlashLoanReceiver is IFlashLoanReceiver {
    address public pool;
    address public owner;

    constructor(address _pool) {
        pool = _pool;
        owner = msg.sender;
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Example logic: do nothing, just repay
        for (uint i = 0; i < assets.length; i++) {
            IERC20(assets[i]).approve(pool, amounts[i] + premiums[i]);
        }
        return true;
    }

    function initiateFlashLoan(address asset, uint256 amount) public onlyOwner {
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        bytes memory params = ""; // No extra params
        IPool(pool).flashLoanSimple(address(this), asset, amount, params, 0);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
}
