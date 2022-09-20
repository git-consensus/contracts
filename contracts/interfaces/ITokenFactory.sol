// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IToken} from "./IToken.sol";

/// @title  ITokenFactoryEvents
/// @author Matt Stam (@mattstam)
/// @notice The interface for the events that may be emitted from Git Consensus's
///         ITokenFactory.
interface ITokenFactoryEvents {
    event TokenCreated(
        address instanceAddr,
        address creatorAddr,
        address govAddr,
        address minterAddr,
        string name,
        string symbol
    );
}

/// @title  ITokenFactory
/// @author Matt Stam (@mattstam)
/// @notice Clone factory for deploying token clones (minimal proxies of `IToken`).
/// @dev    https://blog.openzeppelin.com/workshop-recap-cheap-contract-deployment-through-clones/
///         Only CREATE2 / deterministic creation is supported, since in the Git Consensus Protocol
///         the addresses should be predicted ahead of time.
interface ITokenFactory is ITokenFactoryEvents {
    /// @notice Creates an `IToken` with an optional initial distribution.
    ///   Uses CREATE2 so that the token's address can be computed deterministically
    ///   using predictAddress().
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created token clone.
    function createToken(
        address govAddr,
        address minterAddr,
        string calldata name,
        string calldata symbol,
        address[] calldata owners,
        uint256[] calldata values,
        bytes32 salt
    ) external returns (address instanceAddr);

    /// @notice Predicts the address of an `IToken` deployed using CREATE2 + salt value.
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created token clone.
    function predictAddress(bytes32 salt) external returns (address instanceAddr);
}
