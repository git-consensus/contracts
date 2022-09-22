// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IToken} from "../interfaces/IToken.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";

/// @title  TokenImpl
/// @author Matt Stam (@mattstam)
/// @notice ERC20 token implementation that is compatible with the Git Consensus Protocol.
/// @dev    Used as a template for projects looking to onboard their project. This
///         token is just the OZ implementation with extensions, plus a `minter`
///         that allows the Git Consensus contract to mint new tokens.
contract TokenImpl is
    IToken,
    Initializable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable
{
    address private governorAddr;
    address private minterAddr;
    uint256 private maxMintableTokensPerHash;

    /// @inheritdoc IToken
    function initialize(
        address _govAddr,
        address _minterAddr,
        string calldata _name,
        string calldata _symbol,
        uint256 _maxMintablePerHash,
        address[] calldata _owners,
        uint256[] calldata _values
    ) external initializer {
        if (_owners.length != _values.length) {
            revert InitialDistributionLengthMismatch(_owners.length, _values.length);
        }

        governorAddr = _govAddr;
        minterAddr = _minterAddr;
        maxMintableTokensPerHash = _maxMintablePerHash;

        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);
        __ERC20Votes_init();

        for (uint256 i = 0; i < _owners.length; ++i) {
            address owner = _owners[i];
            uint256 value = _values[i];

            if (value == 0 || owner == address(0)) {
                continue;
            }

            _mint(owner, value);
        }
    }

    /// @inheritdoc IToken
    function governor() external view returns (address governorAddr_) {
        return governorAddr;
    }

    /// @inheritdoc IToken
    function minter() external view returns (address minterAddr_) {
        return minterAddr;
    }

    /// @inheritdoc IToken
    function maxMintablePerHash() external view returns (uint256 max_) {
        return maxMintableTokensPerHash;
    }

    /// @inheritdoc IToken
    function mint(address _to, uint256 _amount) external {
        if (minterAddr != msg.sender) {
            revert UnauthorizedMinter(msg.sender, minterAddr);
        }

        if (maxMintableTokensPerHash != 0 && _amount > maxMintableTokensPerHash) {
            revert MaxMintablePerHashExceeded(_amount, maxMintableTokensPerHash);
        }

        _mint(_to, _amount);
    }

    // --- Overrides required by Solidity ---

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }
}
