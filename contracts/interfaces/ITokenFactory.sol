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
        string symbol,
        uint256 maxMintablePerHash
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
    /// @param govAddr Address of the corresponding governor contract. Recommended usage is
    ///    use address prediction to create the Token first, then create the Governor with
    ///    this Token's address as the `tokenAddr` parameter.
    /// @param minterAddr Address of the contract that will be able to mint new tokens. Should
    ///    always be set to the Git Consensus contract's address.
    /// @param name Name of the token (e.g. "MyToken").
    /// @param symbol Symbol of the token (e.g. "MTK").
    /// @param owners Array of addresses to receive an initial distribution of tokens. MUST
    ///     equal length of `values`.
    /// @param values Array of amounts of tokens to be given to each owner (in wei). The initial
    ///     token supply will be equal to the sum of all `values`. MUST equal length of `owners`.
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created token clone.
    function createToken(
        address govAddr,
        address minterAddr,
        string calldata name,
        string calldata symbol,
        uint256 _maxMintablePerHash,
        address[] calldata owners,
        uint256[] calldata values,
        bytes32 salt
    ) external returns (address instanceAddr);

    /// @notice Predicts the address of an `IToken` deployed using CREATE2 + salt value.
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created token clone.
    function predictAddress(bytes32 salt) external view returns (address instanceAddr);
}
