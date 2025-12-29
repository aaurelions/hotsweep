// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// @title HotSweep - Token Sweeper with EIP-7702, EIP-2612, and EIP-3009
/// @notice Consolidates funds from user addresses to hot wallets using multiple EIP standards
/// @dev Can be used as EIP-7702 delegate OR standalone permit/auth sweeper
contract HotSweep is Ownable {
    using SafeERC20 for IERC20;

    // Immutable owner for EIP-7702 delegate mode
    address private immutable _IMMUTABLE_OWNER;

    struct SweepBatch {
        address token; // address(0) for ETH
        address recipient;
        uint256 amount;
    }

    struct PermitBatch {
        address token;
        address owner;
        uint256 amount;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct AuthBatch {
        address token;
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @param initialOwner Owner address
    constructor(address initialOwner) Ownable(initialOwner) {
        _IMMUTABLE_OWNER = initialOwner;
    }

    /// @dev Returns the address of the current owner.
    function owner() public view virtual override returns (address) {
        return _IMMUTABLE_OWNER;
    }

    /// @dev Overrides transferOwnership to prevent changing the immutable owner.
    function transferOwnership(address) public virtual override {
        revert("Owner is immutable");
    }

    /// @dev Overrides renounceOwnership to prevent changing the immutable owner.
    function renounceOwnership() public virtual override {
        revert("Owner is immutable");
    }

    /// @notice Batch sweep for EIP-7702 delegated EOAs
    /// @dev Executes in the context of the user's EOA. Only owner can trigger.
    /// @param batches Array of sweep operations to execute atomically
    function executeBatchSweep(
        SweepBatch[] calldata batches
    ) external onlyOwner {
        for (uint256 i = 0; i < batches.length; i++) {
            SweepBatch calldata batch = batches[i];
            if (batch.token == address(0)) {
                // Sweep ETH
                (bool success, ) = batch.recipient.call{value: batch.amount}(
                    ""
                );
                require(success, "Sweep: ETH transfer failed");
            } else {
                // Sweep ERC20
                IERC20(batch.token).safeTransfer(batch.recipient, batch.amount);
            }
        }
    }

    /// @notice Batch sweep using EIP-2612 Permit (gasless approvals)
    /// @dev Processes multiple permit + transfer operations atomically
    /// @param batches Array of permit operations with owner signatures
    /// @param recipient Address to receive all swept tokens
    function executeBatchPermitSweep(
        PermitBatch[] calldata batches,
        address recipient
    ) external onlyOwner {
        for (uint256 i = 0; i < batches.length; i++) {
            PermitBatch calldata batch = batches[i];
            // Execute gasless approval via permit
            IERC20Permit(batch.token).permit(
                batch.owner,
                address(this),
                batch.amount,
                batch.deadline,
                batch.v,
                batch.r,
                batch.s
            );
            // Transfer tokens to recipient
            IERC20(batch.token).safeTransferFrom(
                batch.owner,
                recipient,
                batch.amount
            );
        }
    }

    /// @notice Batch sweep using EIP-3009 (e.g., USDC, PYUSD, EURC, USDC.e, etc.)
    /// @dev Anyone can call with valid signatures - tokens go directly to specified addresses
    /// @param batches Array of authorization operations with user signatures
    function executeBatchAuthSweep(AuthBatch[] calldata batches) external {
        for (uint256 i = 0; i < batches.length; i++) {
            AuthBatch calldata batch = batches[i];
            // Execute authorized transfer
            IERC3009(batch.token).transferWithAuthorization(
                batch.from,
                batch.to,
                batch.value,
                batch.validAfter,
                batch.validBefore,
                batch.nonce,
                batch.v,
                batch.r,
                batch.s
            );
        }
    }

    /// @notice Sweep all ETH balance (convenience function for EIP-7702 mode)
    /// @param recipient Address to receive ETH
    function sweepAllEth(address recipient) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Sweep: no ETH balance");
        (bool success, ) = recipient.call{value: balance}("");
        require(success, "Sweep: ETH transfer failed");
    }

    /// @notice Sweep all tokens of a specific type (convenience function for EIP-7702 mode)
    /// @param token ERC20 token address
    /// @param recipient Address to receive tokens
    function sweepAllTokens(
        address token,
        address recipient
    ) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "Sweep: no token balance");
        IERC20(token).safeTransfer(recipient, balance);
    }

    receive() external payable {}
}
