// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGovernor} from "../interfaces/IGovernor.sol";
import {IVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/utils/IVotesUpgradeable.sol";
import {IGovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {GovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import {GovernorSettingsUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import {GovernorCountingSimpleUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import {GovernorVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import {GovernorVotesQuorumFractionUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";

/// @title  GovernorImpl
/// @author Matt Stam (@mattstam)
/// @notice Governor implementation that is compatible with an ERC20 token that is compatible
//          with the Git Consensus Protocol.
/// @dev    This Governor does not have a timelock. Once a proposal is approved, it may be
///         executed. Rationale is that generally we do not want to add additional blockers
///         to existing behavior of projects, and the release process (after a decision has
///         been confirmed to create a release) is instant for existing git projects that
///         have not onboarded to Git Consensus.
///
///         This governor DOES maintain a reference to the token, which can found via the
///         OpenZepplin GovernorVotesUpgradeable `public token()` function.
contract GovernorImpl is
    IGovernor,
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable
{
    /// @inheritdoc IGovernor
    function initialize(
        address _tokenAddr,
        string calldata _name,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator
    ) external initializer {
        __Governor_init(_name);
        __GovernorSettings_init(_votingDelay, _votingPeriod, _proposalThreshold);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(IVotesUpgradeable(_tokenAddr));
        __GovernorVotesQuorumFraction_init(_quorumNumerator);
    }

    // --- Overrides for Git Consensus functionality ---

    /// @dev For projects that did not have an inital token supply (meaning the owners and values in
    ///    ITokens.createToken(.., owners, values, ..) was empty), the first release should be able
    ///    to be successful without any `forVotes`, since no tokens exist yet.
    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(GovernorUpgradeable, GovernorCountingSimpleUpgradeable)
        returns (bool)
    {
        (uint256 againstVotes, uint256 forVotes, ) = proposalVotes(proposalId);

        if (againstVotes == 0 && _quorumReached(proposalId)) {
            return true;
        }
        return forVotes > againstVotes;
    }

    // --- Overrides required by Solidity ---

    function votingDelay()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
}
