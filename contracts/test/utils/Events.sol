// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

/// @title  IERC20Events
/// @notice Helper interface for just the ERC20 events that are needed for testing.
contract IERC20Events {
    /// @dev Emitted when `value` tokens are moved from one account (`from`) to
    ///     another (`to`). Note that `value` may be zero.
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @dev Emitted when the allowance of a `spender` for an `owner` is set by
    ///     a call to approve(). `value` is the new allowance.
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
