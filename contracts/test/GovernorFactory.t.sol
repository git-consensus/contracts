// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGovernorFactoryEvents} from "../interfaces/IGovernorFactory.sol";
import {Test} from "./utils/Test.sol";
import {GovernorFactory} from "../clones/GovernorFactory.sol";
import {GovernorImpl} from "../clones/GovernorImpl.sol";

contract BaseSetup is Test, IGovernorFactoryEvents {
    GovernorFactory internal factory;

    function setUp() public virtual {
        GovernorImpl template = new GovernorImpl();
        factory = new GovernorFactory(template);
    }
}

contract WhenCreatingNewGovernor is BaseSetup {
    function testOk_createGovernor(
        address _creatorAddr,
        address _tokenAddr,
        string memory _name,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator,
        bytes32 _createSalt
    ) public {
        vm.assume(_votingDelay > 0);
        vm.assume(_votingPeriod > 0);
        vm.assume(_quorumNumerator > 0);
        vm.assume(_quorumNumerator <= 100);

        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit GovernorCreated(
            expectedAddr,
            _creatorAddr,
            _tokenAddr,
            _name,
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _quorumNumerator
        );

        vm.prank(_creatorAddr);
        factory.createGovernor(
            _tokenAddr,
            _name,
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _quorumNumerator,
            _createSalt
        );
    }

    function testOk_predictGovernorAddress(bytes32 _createSalt) public view {
        factory.predictAddress(_createSalt);
    }
}

contract GasBenchmark is BaseSetup {
    address internal tokenAddr = address(uint160(uint256(keccak256(""))));
    string internal name = "TestGovernor";
    uint256 internal votingDelay = 10; // 10 blocks before voting begins
    uint256 internal votingPeriod = 100800; // 2 weeks (assumes 12/s per block)
    uint256 internal proposalThreshold = 100; // 100 votes needed to propose
    uint256 internal quorumNumerator = 5; // 5% of total votes needed to reach quorum

    function testGas_createGovernor() public {
        factory.createGovernor(
            tokenAddr,
            name,
            votingDelay,
            votingPeriod,
            proposalThreshold,
            quorumNumerator,
            bytes32(0)
        );
    }
}
