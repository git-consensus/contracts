// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {ITokenFactory} from "../interfaces/ITokenFactory.sol";
import {IToken} from "../interfaces/IToken.sol";
import {TokenImpl} from "./TokenImpl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title TokenFactory
/// @author Matt Stam (@mattstam)
/// @notice A Git Consensus Protocol TokenFactory implementation.
contract TokenFactory is ITokenFactory {
    using Clones for address;

    /// @dev The reference contract template in which all clones will be generated from.
    IToken private immutable tokenTemplate;

    constructor(IToken _tokenTemplate) {
        tokenTemplate = _tokenTemplate;
    }

    /// @inheritdoc ITokenFactory
    function createToken(
        address _govAddr,
        address _minterAddr,
        string calldata _name,
        string calldata _symbol,
        uint256 _maxMintablePerHash,
        address[] calldata _owners,
        uint256[] calldata _values,
        bytes32 _salt
    ) external returns (address instanceAddr_) {
        instanceAddr_ = address(tokenTemplate).cloneDeterministic(_salt);
        IToken(instanceAddr_).initialize(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            _owners,
            _values
        );

        emit TokenCreated(
            instanceAddr_,
            msg.sender,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );
    }

    /// @inheritdoc ITokenFactory
    function predictAddress(bytes32 _salt) external view returns (address instanceAddr_) {
        return address(tokenTemplate).predictDeterministicAddress(_salt);
    }
}
