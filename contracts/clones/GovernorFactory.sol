// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;
import {IGovernorFactory} from "../interfaces/IGovernorFactory.sol";
import {IGovernor} from "../interfaces/IGovernor.sol";
import {GovernorImpl} from "./GovernorImpl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title  GovernorFactory
/// @author Matt Stam (@mattstam)
/// @notice A Git Consensus Protocol GovernorFactory implementation.
contract GovernorFactory is IGovernorFactory {
    using Clones for address;

    /// @dev The reference contract template in which all clones will be generated from.
    IGovernor private immutable governorTemplate;

    constructor(IGovernor _governorTemplate) {
        governorTemplate = _governorTemplate;
    }

    /// @inheritdoc IGovernorFactory
    function createGovernor(
        address _tokenAddr,
        string calldata _name,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator,
        bytes32 _salt
    ) external returns (address instanceAddr_) {
        instanceAddr_ = address(governorTemplate).cloneDeterministic(_salt);
        IGovernor(instanceAddr_).initialize(
            _tokenAddr,
            _name,
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _quorumNumerator
        );

        emit GovernorCreated(
            instanceAddr_,
            msg.sender,
            _tokenAddr,
            _name,
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _quorumNumerator
        );
    }

    /// @inheritdoc IGovernorFactory
    function predictAddress(bytes32 _salt) external view returns (address instanceAddr_) {
        return address(governorTemplate).predictDeterministicAddress(_salt);
    }
}
