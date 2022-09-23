// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGovernor} from "../interfaces/IGovernor.sol";

/// @title  IGovernorFactoryEvents
/// @author Matt Stam (@mattstam)
/// @notice The interface for the events that may be emitted from Git Consensus's
///         IGovernorFactory.
interface IGovernorFactoryEvents {
    event GovernorCreated(
        address instanceAddr,
        address creatorAddr,
        address tokenAddr,
        string name,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumNumerator
    );
}

/// @title  IGovernorFactory
/// @author Matt Stam (@mattstam)
/// @notice Clone factory for deploying token clones (minimal proxies of `IGovernor`).
/// @dev    https://blog.openzeppelin.com/workshop-recap-cheap-contract-deployment-through-clones/
///         Only CREATE2 / deterministic creation is supported, since in the Git Consensus Protocol
///         onboarding, the addresses will always need to be be predicted ahead of time.
///
///         The usual flow is:
///         1. Predict the address of the governor using GovernorFactory.predictAddress()
///         2. Deploy the token using TokenFactory.createToken(..., govAddr, ...)
///         3. Deploy the governor using GovernorFactory.createGovernor(..., tokenAddr, ...)
interface IGovernorFactory is IGovernorFactoryEvents {
    /// @notice Creates an `IGovernor` with an optional initial distribution.
    ///     Uses CREATE2 so that the governor's address can be computed deterministically
    ///     using predictAddress().
    /// @param tokenAddr The ERC20 token that will be used for voting.
    /// @param name Name of the governor (e.g. "ExampleGovernor").
    /// @param votingDelay The number of blocks that must pass between a proposal being
    ///     proposed and when it becomes executable (e.g. 1 = 1 block).
    /// @param votingPeriod The number of blocks that voting is open for a proposal
    ///     (e.g. 100800 = 2 weeks = 12/s per block).
    /// @param proposalThreshold The minimum number of votes required for an account to
    ///      create a proposal (e.g. 0 = anyone can create a proposal).
    /// @param quorumNumerator The quorumNumerator/100 to give a percentage representing
    ///     minimum number of votes out of the supply required to pass a proposal (e.g. 5 = 5%).
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created governor clone.
    function createGovernor(
        address tokenAddr,
        string memory name,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumNumerator,
        bytes32 salt
    ) external returns (address instanceAddr);

    /// @notice Predicts the address of an `IGovernor` deployed using CREATE2 + salt value.
    /// @param salt The salt value used by CREATE2.
    /// @return instanceAddr The address of the newly created governor clone.
    function predictAddress(bytes32 salt) external view returns (address instanceAddr);
}
