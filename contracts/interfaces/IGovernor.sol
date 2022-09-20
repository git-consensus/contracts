// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

/// @title  IGovernor
/// @author Matt Stam (@mattstam)
/// @notice The standard Governor that uses an ERC20 token for voting on proposals.
/// @dev    OpenZepplin IGovernor but with initialize(), since using clones + minimal-clones
///         for cheapest possible token deployment.
///
///         There is nothing Git Consensus specific about this governor. A typical use-case
///         for governor's in the Etheruem ecosystem is to set it to the "*owner* of a contract,
///         and then protect some of the contract's functions with the `onlyOwner()` modifier
///         (see: https://docs.openzeppelin.com/contracts/2.x/access-control and
///         https://docs.openzeppelin.com/contracts/2.x/api/ownership#Ownable).
///
///         What is novel is that Git Consensus effectively makes `addRelease()` dynamically
///         *ownable*, such that the only one calling it can be the one in the git tag message.
interface IGovernor {
    /// @notice Initializes the Governor contract.
    /// @param tokenAddr The ERC20 token that will be used for voting.
    /// @param name Name of the governor (e.g. "ExampleGovernor").
    /// @param votingDelay The number of blocks that must pass between a proposal being
    ///     proposed and when it becomes executable (e.g. 1 = 1 block).
    /// @param votingPeriod The number of blocks that voting is open for a proposal
    ///     (e.g. 100800 = 2 weeks = 12/s per block).
    /// @param proposalThreshold The minimum number of votes required for an account to
    //      create a proposal (e.g. 0 = anyone can create a proposal).
    /// @param quorumNumerator The quorumNumerator/100 to give a percentage representing
    ///     minimum number of votes out of the supply required to pass a proposal (e.g. 5 = 5%).
    function initialize(
        address tokenAddr,
        string memory name,
        uint256 votingDelay,
        uint256 votingPeriod,
        uint256 proposalThreshold,
        uint256 quorumNumerator
    ) external;
}
