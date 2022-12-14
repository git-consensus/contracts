// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGitConsensusTypes} from "../interfaces/IGitConsensus.sol";
import {ITokenFactoryEvents} from "../interfaces/ITokenFactory.sol";
import {IToken} from "../interfaces/IToken.sol";
import {IERC20Events} from "./utils/Events.sol";
import {Test} from "./utils/Test.sol";
import {Distibution} from "./utils/Distribution.sol";
import {TokenFactory} from "../clones/TokenFactory.sol";
import {TokenImpl} from "../clones/TokenImpl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BaseSetup is Test, IGitConsensusTypes, ITokenFactoryEvents, IERC20Events {
    TokenFactory internal factory;

    function setUp() public virtual {
        TokenImpl template = new TokenImpl();
        factory = new TokenFactory(template);
    }
}

// TODO: Check created token and ensure params

contract WhenCreatingNewToken is BaseSetup {
    function testOk_createTokenEmptyDistribution(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        uint256 _maxMintablePerHash,
        bytes32 _createSalt
    ) public {
        address[] memory owners = new address[](1);
        uint256[] memory values = new uint256[](1);
        owners[0] = address(0);
        values[0] = 0;

        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            owners,
            values,
            _createSalt
        );
    }

    function testOk_createTokenStaticDistribution(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        uint256 _maxMintablePerHash,
        uint256 _distributionValue,
        uint256 _distributionLength,
        bytes32 _createSalt
    ) public {
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        (address[] memory owners, uint256[] memory values) = Distibution
            .newStaticInitialDistribution(_distributionValue, _distributionLength);

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0) || values[i] == 0) {
                continue;
            }
            vm.expectEmit(true, true, false, true);
            emit Transfer(address(0), owners[i], values[i]);
        }
        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            owners,
            values,
            _createSalt
        );
    }

    function testOk_createTokenRandomDistribution(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        uint256 _maxMintablePerHash,
        uint256 _distributionValue,
        uint256 _distributionLength,
        bytes32 _distributionSalt,
        bytes32 _createSalt
    ) public {
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        (address[] memory owners, uint256[] memory values) = Distibution
            .newRandomInitialDistribution(
                _distributionValue,
                _distributionLength,
                _distributionSalt
            );

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0) || values[i] == 0) {
                continue;
            }
            vm.expectEmit(true, true, false, true);
            emit Transfer(address(0), owners[i], values[i]);
        }
        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            owners,
            values,
            _createSalt
        );
    }

    function testOk_createTokenDeterministicStaticDistribution(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        uint256 _maxMintablePerHash,
        uint256 _distributionValue,
        uint256 _distributionLength,
        bytes32 _createSalt
    ) public {
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        (address[] memory owners, uint256[] memory values) = Distibution
            .newStaticInitialDistribution(_distributionValue, _distributionLength);

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0) || values[i] == 0) {
                continue;
            }
            vm.expectEmit(true, true, false, true);
            emit Transfer(address(0), owners[i], values[i]);
        }
        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            owners,
            values,
            _createSalt
        );
    }

    function testOk_createTokenDeterministicRandomDistribution(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        uint256 _maxMintablePerHash,
        uint256 _distributionValue,
        uint256 _distributionLength,
        bytes32 _distributionSalt,
        bytes32 _createSalt
    ) public {
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        (address[] memory owners, uint256[] memory values) = Distibution
            .newRandomInitialDistribution(
                _distributionValue,
                _distributionLength,
                _distributionSalt
            );

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == address(0) || values[i] == 0) {
                continue;
            }
            vm.expectEmit(true, true, false, true);
            emit Transfer(address(0), owners[i], values[i]);
        }
        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            _maxMintablePerHash,
            owners,
            values,
            _createSalt
        );
    }

    function testOk_predictTokenAddress(bytes32 _createSalt) public view {
        factory.predictAddress(_createSalt);
    }
}

contract WhenAfterTokenCreated is BaseSetup {
    function testOk_createdTokenZeroMaxMintablePerHash(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        bytes32 _createSalt
    ) public {
        vm.assume(_creatorAddr != address(0));
        address[] memory owners = new address[](1);
        uint256[] memory values = new uint256[](1);
        owners[0] = address(0);
        values[0] = 0;

        // zero values should be treated as no maximum
        uint256 maxMintablePerHash = 0;

        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        address tokenAddr = factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            maxMintablePerHash,
            owners,
            values,
            _createSalt
        );

        IToken token = IToken(tokenAddr);
        assertEq(0, token.maxMintablePerHash());

        vm.prank(_minterAddr);
        token.mint(_creatorAddr, type(uint224).max); // maximum token supply for ERC20Votes
        IERC20 tokenERC20 = IERC20(tokenAddr);
        assertEq(type(uint224).max, tokenERC20.balanceOf(_creatorAddr));
    }

    function testOk_createdTokenAboveMaxMintablePerHashFailed(
        address _creatorAddr,
        address _govAddr,
        address _minterAddr,
        string memory _name,
        string memory _symbol,
        bytes32 _createSalt
    ) public {
        vm.assume(_creatorAddr != address(0));
        address[] memory owners = new address[](1);
        uint256[] memory values = new uint256[](1);
        owners[0] = address(0);
        values[0] = 0;

        uint256 maxMintablePerHash = 1000;

        address expectedAddr = factory.predictAddress(_createSalt);
        vm.expectEmit(true, false, false, true);
        emit TokenCreated(
            expectedAddr,
            _creatorAddr,
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            maxMintablePerHash
        );

        vm.prank(_creatorAddr);
        address tokenAddr = factory.createToken(
            _govAddr,
            _minterAddr,
            _name,
            _symbol,
            maxMintablePerHash,
            owners,
            values,
            _createSalt
        );

        IToken token = IToken(tokenAddr);
        assertEq(maxMintablePerHash, token.maxMintablePerHash());

        vm.expectRevert(
            abi.encodeWithSignature(
                "MaxMintablePerHashExceeded(uint256,uint256)",
                maxMintablePerHash + 1,
                maxMintablePerHash
            )
        );
        vm.prank(_minterAddr);
        token.mint(_creatorAddr, maxMintablePerHash + 1);
    }
}

contract GasBenchmark is BaseSetup {
    address internal govAddr = address(uint160(uint256(keccak256("foo"))));
    address internal minterAddr = address(uint160(uint256(keccak256("bar"))));
    string internal name = "TestToken";
    string internal symbol = "TTT";
    uint256 internal maxMintablePerHash = 10000000; // 10,000,000
    uint256 internal distributionValue = 300;
    uint256 internal distributionLength = 9;
    bytes32 internal distributionSalt = "";
    bytes32 internal createSalt = "";

    function testGas_createTokenStatic() public {
        (address[] memory owners, uint256[] memory values) = Distibution
            .newStaticInitialDistribution(distributionValue, distributionLength);

        factory.createToken(
            govAddr,
            minterAddr,
            name,
            symbol,
            maxMintablePerHash,
            owners,
            values,
            createSalt
        );
    }

    function testGas_createTokenRandom() public {
        (address[] memory owners, uint256[] memory values) = Distibution
            .newRandomInitialDistribution(distributionValue, distributionLength, distributionSalt);

        factory.createToken(
            govAddr,
            minterAddr,
            name,
            symbol,
            maxMintablePerHash,
            owners,
            values,
            createSalt
        );
    }
}
