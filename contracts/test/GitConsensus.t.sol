// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;
import {IGitConsensus, IGitConsensusErrors, IGitConsensusEvents, IGitConsensusTypes} from "../interfaces/IGitConsensus.sol";
import {GitConsensus} from "../GitConsensus.sol";
import {Test} from "./utils/Test.sol";
import {Utils} from "./utils/Utils.sol";
import {Distibution} from "./utils/Distribution.sol";
import {TokenFactory} from "../clones/TokenFactory.sol";
import {TokenImpl} from "../clones/TokenImpl.sol";
import {GovernorFactory} from "../clones/GovernorFactory.sol";
import {GovernorImpl} from "../clones/GovernorImpl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract BaseSetup is Test, IGitConsensusErrors, IGitConsensusEvents, IGitConsensusTypes {
    /// @dev actual GitConsensus contract that contains state changes
    GitConsensus internal aGitConsensus;
    /// @dev copy of GitConsensus for generating expected hashes against
    GitConsensus internal mGitConsensus;

    TokenFactory internal tokenFactory;
    GovernorFactory internal govFactory;

    address internal alice;
    address internal bob;

    TagData tagDataEmpty;
    CommitData commitDataEmpty;

    // for initial distribution
    address[] owners;
    uint256[] values;

    function setUp() public virtual {
        // Actual GitConsensus contract to test against
        aGitConsensus = new GitConsensus();
        // Mock GitConsensus contract to pre-build hashes against
        mGitConsensus = new GitConsensus();

        uint256 userNum = 5;
        address payable[] memory users = new address payable[](userNum);
        bytes32 nextUser = keccak256(abi.encodePacked("user address"));
        for (uint256 i = 0; i < userNum; i++) {
            // get next user address
            address payable user = payable(address(uint160(uint256(nextUser))));
            nextUser = keccak256(abi.encodePacked(nextUser));
            vm.deal(user, 100 ether);
            users[i] = user;
        }

        alice = users[0];
        vm.label(alice, "Alice");
        bob = users[1];
        vm.label(bob, "Bob");

        commitDataEmpty = CommitData({
            tree: "",
            parents: "",
            author: "",
            committer: "",
            message: "",
            signature: ""
        });

        tagDataEmpty = TagData({
            object: "",
            tagType: "",
            tagName: "",
            tagger: "",
            message: "",
            signature: ""
        });

        tokenFactory = new TokenFactory(new TokenImpl());
        govFactory = new GovernorFactory(new GovernorImpl());
        (owners, values) = Distibution.newStaticInitialDistribution(5000, 10);
    }

    // Some static params for Token<->Governor pair.
    // The governor voting params don't matter as will immediately
    // spoof calls from the governor's address to GitConsensus anyway.
    string internal tokenName = "TestToken";
    string internal tokenSymbol = "TTT";
    string internal govName = "TestGovernor";
    uint256 internal votingDelay = 10; // 10 blocks before voting begins
    uint256 internal votingPeriod = 100800; // 2 weeks (assumes 12/s per block)
    uint256 internal proposalThreshold = 100; // 100 votes needed to propose
    uint256 internal quorumNumerator = 5; // 5% of total votes needed to reach quorum

    /// @notice Helper function to create new Token<->Governor pairs on-demand. Emulates the usual
    ///     flow a new project would go through to set these up (predicting governor address first,
    ///     then creating each).
    /// @dev Testing `addCommit()` would work fine on it's own, but `addRelease()` actually needs
    ///     a Token set up with a backing governor, otherwise checking the governor as the msg.sender
    ///     would fail, as would the actual minting of new tokens.
    function createTokenGovPair(bytes32 _tokenSalt, bytes32 _govSalt)
        public
        virtual
        returns (address tokenAddr_, address govAddr_)
    {
        govAddr_ = govFactory.predictAddress(_govSalt);

        tokenAddr_ = tokenFactory.createToken(
            govAddr_,
            address(aGitConsensus),
            tokenName,
            tokenSymbol,
            owners,
            values,
            _tokenSalt
        );

        govFactory.createGovernor(
            tokenAddr_,
            govName,
            votingDelay,
            votingPeriod,
            proposalThreshold,
            quorumNumerator,
            _govSalt
        );
    }
}

contract WhenCallingGitConsensus is BaseSetup {
    /// --- Commits ---
    function testOk_commitEmptyFailed(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        vm.expectRevert(abi.encodeWithSignature("CommitMsgNeedsAddr(string)", ""));
        aGitConsensus.addCommit(commitDataEmpty);
    }

    function testOk_commitPartialFailed(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        CommitData memory commit = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: "\n\n",
            signature: "\n"
        });

        vm.expectRevert(abi.encodeWithSignature("CommitMsgNeedsAddr(string)", commit.message));
        aGitConsensus.addCommit(commit);
    }

    function testOk_commitFilledFailed(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        string memory signature = "-----BEGIN PGP SIGNATURE-----\n"
        " \n"
        " mQINBGKjSRsBEADg433Wg9tJzbes9/7mi0GvM7gTYUu9BZ9UzgxdD2nXCPQd4hSx\n"
        " uOBmQokTsVH8Fgr7fgkjzay78E4xr21NpJsYp5xWrsKEPUfVYnC717bhZibkliYj\n"
        " 5N79A+EjTYPRNOGNMsPeNjTrvGwheJBSO1jcLQ/PcuzE4rSeoNn8yO/5W0POEhtZ\n"
        " U2MHax1L+65Cbxc2iVkQqsM3j9KUUWrhAZfeQwdHccaTJxPkW8gdLyKau5hZoLGX\n"
        " cwRnEZrlUWyHR5yLJu7PG9m3nnTFpBk3IUYx6O9ZdIXq+nx6j7DQe0gY9NtQKr9f\n"
        " Y7hdRGa44SqiCiisw/Jdp8mgidYwnc9HhP9lDHNXp0hut1pZ4a1A0SGhzhYcWcqk\n"
        " g+BgyT+rDzkX9ZLBJhJQWEeN/sPcco+2M4xPYkKNpBiI0XQWL5e8dgqEoytJVtIu\n"
        " EGe7WTYkB+ovEljxL+0uBHLopEjJMl3vt2+cXQTw+biDuWv80P3Gw53QtsJ0srWy\n"
        " opLA1Dk4eAuDw34qKwb5ycHJE+ykJXKSB4r9t0dFp6eCG08rOVnOn1YDzKQCTQ5N\n"
        " Pm1fi89wrh/6C3O/35PwYvbCfR4XDy8jiSu4hGNZ5qnCBgZu4f+R20THeyGCV1SX\n"
        " QnPC0vPEXGceR95/U8xwHXcqHiceq5rSwdXod3QNmHLBe+MUZo1dPOQYYQARAQAB\n"
        " tAZzYWRzZGGJAhwEEAECAAYFAmKjSRsACgkQEHturBgkYBHj5g//eyXKPbBRvy1W\n"
        " AZArUTNOW7EBl7F2rv34RS48oxhcuGekLfFryAMG8Xij2+u9Oksl3zQ4ANsMDpiQ\n"
        " gt2JpjflvqBqx5WTRb9An6p6ixpDXxrKPYEt5fyqUuG3C/V+cUfVKnG7mPLaZKST\n"
        " iy22chfyOw4zrDyLr07G9IFIA6vWt2a7vz0OurkkUPnERZs29Yj7eXgH7VZ/tPJT\n"
        " EmIv9sAeMggFWOscv7xNV3fm14y3FyrrbfnO51blXHZ19IgdkwIGLh3Rh7vjeU3M\n"
        " UE0XEq5K5OUUVR5oWyq0ROoQ/GRexddPbYX86cvGPND6UzBHjlM7QPEEtFBbwXi+\n"
        " i7+1QJ+/gqoLSzUQcwIEkUxrLiWvSdA2T3vZk1fhJSKPZW8/i7puAluGVPWhZJkC\n"
        " fqB6Jt2Sfh/Iy+zmHsJqUtwylU/Kcaq6pszokJwztAkBOWk1UVu2pN3rJMFwG8IZ\n"
        " z4/8PB4Rm/bj/CG7tbu5j+cc/mEcGam8yRK/E8LCysZ7U+KZpkAC2n3AOma8fqiY\n"
        " OXGqM/6ukJEA77PB3i//GQS1rEUjas0o3MhXCHP4D8jmjAS+BC+Ul3kc/6ZOWZ8C\n"
        " b7mxMunLEAMCJFXrMeg55nUFgaY5I7QoF7oSi356a07pbG2A4XCbF/affElND6LN\n"
        " CMOcnVMe/grOCXUHOMlWl5E9ACMyn58==1mwf\n"
        " -----END PGP SIGNATURE-----\n";
        CommitData memory commit = CommitData({
            tree: "tree 01b2a2f9aa2d1d1df4299fad6ed02bb20841b1fd\n",
            parents: "parents 4a793d306153b16e4bf680a11d01674b9b537f02 52b2a2f9aa2d1d1df4299fad6ed12bd40841b1fd\n",
            author: "author Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n",
            committer: "commiter Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n\n",
            message: "\nhello world \n",
            signature: signature
        });

        vm.expectRevert(abi.encodeWithSignature("CommitMsgNeedsAddr(string)", commit.message));
        aGitConsensus.addCommit(commit);
    }

    function testOk_commitEmptyMsgAddrMalformed(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        // second half of address is missing
        commitDataEmpty.message = string(
            Utils.slice(bytes(Strings.toHexString(_ownerAddr)), 0, 21)
        );

        vm.expectRevert(
            abi.encodeWithSignature("CommitMsgNeedsAddr(string)", commitDataEmpty.message)
        );
        aGitConsensus.addCommit(commitDataEmpty);
    }

    function testOk_commitEmptyMsgAddr(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        commitDataEmpty.message = Strings.toHexString(_ownerAddr);

        bytes20 commitHashExpected = mGitConsensus.addCommit(commitDataEmpty);
        assertFalse(aGitConsensus.commitExists(commitHashExpected));
        assertEq(address(0), aGitConsensus.commitAddr(commitHashExpected));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr, commitHashExpected);

        bytes20 commitHash = aGitConsensus.addCommit(commitDataEmpty);
        assertTrue(aGitConsensus.commitExists(commitHash));
        assertEq(_ownerAddr, aGitConsensus.commitAddr(commitHash));

        assertEq(commitHashExpected, commitHash);
    }

    function testOk_commitPartialMsgAddr(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        CommitData memory commit = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(_ownerAddr))), "\n")
            ),
            signature: "\n"
        });

        bytes20 commitHashExpected = mGitConsensus.addCommit(commit);
        assertFalse(aGitConsensus.commitExists(commitHashExpected));
        assertEq(address(0), aGitConsensus.commitAddr(commitHashExpected));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr, commitHashExpected);

        bytes20 commitHash = aGitConsensus.addCommit(commit);
        assertTrue(aGitConsensus.commitExists(commitHash));
        assertEq(_ownerAddr, aGitConsensus.commitAddr(commitHash));

        assertEq(commitHashExpected, commitHash);
    }

    function testOk_commitFilledMsgAddr(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        string memory signature = "-----BEGIN PGP SIGNATURE-----\n"
        " \n"
        " mQINBGKjSRsBEADg433Wg9tJzbes9/7mi0GvM7gTYUu9BZ9UzgxdD2nXCPQd4hSx\n"
        " uOBmQokTsVH8Fgr7fgkjzay78E4xr21NpJsYp5xWrsKEPUfVYnC717bhZibkliYj\n"
        " 5N79A+EjTYPRNOGNMsPeNjTrvGwheJBSO1jcLQ/PcuzE4rSeoNn8yO/5W0POEhtZ\n"
        " U2MHax1L+65Cbxc2iVkQqsM3j9KUUWrhAZfeQwdHccaTJxPkW8gdLyKau5hZoLGX\n"
        " cwRnEZrlUWyHR5yLJu7PG9m3nnTFpBk3IUYx6O9ZdIXq+nx6j7DQe0gY9NtQKr9f\n"
        " Y7hdRGa44SqiCiisw/Jdp8mgidYwnc9HhP9lDHNXp0hut1pZ4a1A0SGhzhYcWcqk\n"
        " g+BgyT+rDzkX9ZLBJhJQWEeN/sPcco+2M4xPYkKNpBiI0XQWL5e8dgqEoytJVtIu\n"
        " EGe7WTYkB+ovEljxL+0uBHLopEjJMl3vt2+cXQTw+biDuWv80P3Gw53QtsJ0srWy\n"
        " opLA1Dk4eAuDw34qKwb5ycHJE+ykJXKSB4r9t0dFp6eCG08rOVnOn1YDzKQCTQ5N\n"
        " Pm1fi89wrh/6C3O/35PwYvbCfR4XDy8jiSu4hGNZ5qnCBgZu4f+R20THeyGCV1SX\n"
        " QnPC0vPEXGceR95/U8xwHXcqHiceq5rSwdXod3QNmHLBe+MUZo1dPOQYYQARAQAB\n"
        " tAZzYWRzZGGJAhwEEAECAAYFAmKjSRsACgkQEHturBgkYBHj5g//eyXKPbBRvy1W\n"
        " AZArUTNOW7EBl7F2rv34RS48oxhcuGekLfFryAMG8Xij2+u9Oksl3zQ4ANsMDpiQ\n"
        " gt2JpjflvqBqx5WTRb9An6p6ixpDXxrKPYEt5fyqUuG3C/V+cUfVKnG7mPLaZKST\n"
        " iy22chfyOw4zrDyLr07G9IFIA6vWt2a7vz0OurkkUPnERZs29Yj7eXgH7VZ/tPJT\n"
        " EmIv9sAeMggFWOscv7xNV3fm14y3FyrrbfnO51blXHZ19IgdkwIGLh3Rh7vjeU3M\n"
        " UE0XEq5K5OUUVR5oWyq0ROoQ/GRexddPbYX86cvGPND6UzBHjlM7QPEEtFBbwXi+\n"
        " i7+1QJ+/gqoLSzUQcwIEkUxrLiWvSdA2T3vZk1fhJSKPZW8/i7puAluGVPWhZJkC\n"
        " fqB6Jt2Sfh/Iy+zmHsJqUtwylU/Kcaq6pszokJwztAkBOWk1UVu2pN3rJMFwG8IZ\n"
        " z4/8PB4Rm/bj/CG7tbu5j+cc/mEcGam8yRK/E8LCysZ7U+KZpkAC2n3AOma8fqiY\n"
        " OXGqM/6ukJEA77PB3i//GQS1rEUjas0o3MhXCHP4D8jmjAS+BC+Ul3kc/6ZOWZ8C\n"
        " b7mxMunLEAMCJFXrMeg55nUFgaY5I7QoF7oSi356a07pbG2A4XCbF/affElND6LN\n"
        " CMOcnVMe/grOCXUHOMlWl5E9ACMyn58==1mwf\n"
        " -----END PGP SIGNATURE-----\n";
        CommitData memory commit = CommitData({
            tree: "tree 01b2a2f9aa2d1d1df4299fad6ed02bb20841b1fd\n",
            parents: "parents 4a793d306153b16e4bf680a11d01674b9b537f02 52b2a2f9aa2d1d1df4299fad6ed12bd40841b1fd\n",
            author: "author Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n",
            committer: "commiter Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n\n",
            message: string(
                Utils.concat(
                    Utils.concat("\nhello world", bytes(Strings.toHexString(_ownerAddr))),
                    "\n"
                )
            ),
            signature: signature
        });

        bytes20 commitHashExpected = mGitConsensus.addCommit(commit);
        assertFalse(aGitConsensus.commitExists(commitHashExpected));
        assertEq(address(0), aGitConsensus.commitAddr(commitHashExpected));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr, commitHashExpected);

        bytes20 commitHash = aGitConsensus.addCommit(commit);
        assertTrue(aGitConsensus.commitExists(commitHash));
        assertEq(_ownerAddr, aGitConsensus.commitAddr(commitHash));

        assertEq(commitHashExpected, commitHash);
    }

    function testOk_commitTwoHashDiffMsgStrNotMatch(address _ownerAddr) public {
        vm.assume(_ownerAddr != address(0));

        CommitData memory commit1 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\nfoo", bytes(Strings.toHexString(_ownerAddr))), "\n")
            ),
            signature: "\n"
        });
        CommitData memory commit2 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\nbar", bytes(Strings.toHexString(_ownerAddr))), "\n")
            ),
            signature: "\n"
        });

        bytes20 commitHashExpected1 = mGitConsensus.addCommit(commit1);
        bytes20 commitHashExpected2 = mGitConsensus.addCommit(commit2);

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr, commitHashExpected1);
        bytes20 commitHash1 = aGitConsensus.addCommit(commit1);
        assertTrue(aGitConsensus.commitExists(commitHash1));
        assertEq(_ownerAddr, aGitConsensus.commitAddr(commitHash1));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr, commitHashExpected2);
        bytes20 commitHash2 = aGitConsensus.addCommit(commit2);
        assertTrue(aGitConsensus.commitExists(commitHash2));
        assertEq(_ownerAddr, aGitConsensus.commitAddr(commitHash2));

        assertFalse(commitHash2 == commitHash1);
    }

    function testOk_commitTwoHashDiffMsgAddrNotMatch(address _ownerAddr1, address _ownerAddr2)
        public
    {
        vm.assume(_ownerAddr1 != address(0));
        vm.assume(_ownerAddr2 != address(0));
        vm.assume(_ownerAddr1 != _ownerAddr2);

        CommitData memory commit1 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(_ownerAddr1))), "\n")
            ),
            signature: "\n"
        });

        CommitData memory commit2 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(_ownerAddr2))), "\n")
            ),
            signature: "\n"
        });

        bytes20 commitHashExpected1 = mGitConsensus.addCommit(commit1);
        bytes20 commitHashExpected2 = mGitConsensus.addCommit(commit2);

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr1, commitHashExpected1);
        bytes20 commitHash1 = aGitConsensus.addCommit(commit1);
        assertTrue(aGitConsensus.commitExists(commitHash1));
        assertEq(_ownerAddr1, aGitConsensus.commitAddr(commitHash1));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr2, commitHashExpected2);
        bytes20 commitHash2 = aGitConsensus.addCommit(commit2);
        assertTrue(aGitConsensus.commitExists(commitHash2));
        assertEq(_ownerAddr2, aGitConsensus.commitAddr(commitHash2));

        assertFalse(commitHash2 == commitHash1);
    }

    function testOk_commitTwoHashDiffMsgAddrNotMatchWSender(
        address _ownerAddr1,
        address _ownerAddr2
    ) public {
        vm.assume(_ownerAddr1 != address(0));
        vm.assume(_ownerAddr2 != address(0));
        vm.assume(_ownerAddr1 != _ownerAddr2);

        CommitData memory commit1 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(_ownerAddr1))), "\n")
            ),
            signature: "\n"
        });

        CommitData memory commit2 = CommitData({
            tree: "tree \n",
            parents: "parents \n",
            author: "author \n",
            committer: "commiter \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(_ownerAddr2))), "\n")
            ),
            signature: "\n"
        });

        bytes20 commitHashExpected1 = mGitConsensus.addCommit(commit1);
        bytes20 commitHashExpected2 = mGitConsensus.addCommit(commit2);

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr1, commitHashExpected1);
        vm.prank(_ownerAddr1);
        bytes20 commitHash1 = aGitConsensus.addCommit(commit1);
        assertTrue(aGitConsensus.commitExists(commitHash1));
        assertEq(_ownerAddr1, aGitConsensus.commitAddr(commitHash1));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(_ownerAddr2, commitHashExpected2);
        vm.prank(_ownerAddr2);
        bytes20 commitHash2 = aGitConsensus.addCommit(commit2);
        assertTrue(aGitConsensus.commitExists(commitHash2));
        assertEq(_ownerAddr2, aGitConsensus.commitAddr(commitHash2));

        assertFalse(commitHash2 == commitHash1);
    }

    // --- Releases ---

    function testOk_releaseEmptyFailed(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        bytes20[] memory hashes;
        uint256[] memory values;

        vm.expectRevert(abi.encodeWithSignature("TagMsgNeedsAddr(string)", ""));
        aGitConsensus.addRelease(tagDataEmpty, hashes, values);
    }

    function testOk_releasePartialFailed(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        TagData memory tagData = TagData({
            object: "object \n",
            tagType: "type \n",
            tagName: "tag \n",
            tagger: "tagger \n",
            message: "\n\n",
            signature: "\n"
        });

        bytes20[] memory hashes;
        uint256[] memory values;

        vm.expectRevert(abi.encodeWithSignature("TagMsgNeedsAddr(string)", tagData.message));
        aGitConsensus.addRelease(tagData, hashes, values);
    }

    function testOk_releaseFilledFailed(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        string memory signature = "-----BEGIN PGP SIGNATURE-----"
        ""
        "mQINBGKjSRsBEADg433Wg9tJzbes9/7mi0GvM7gTYUu9BZ9UzgxdD2nXCPQd4hSx"
        "uOBmQokTsVH8Fgr7fgkjzay78E4xr21NpJsYp5xWrsKEPUfVYnC717bhZibkliYj"
        "5N79A+EjTYPRNOGNMsPeNjTrvGwheJBSO1jcLQ/PcuzE4rSeoNn8yO/5W0POEhtZ"
        "U2MHax1L+65Cbxc2iVkQqsM3j9KUUWrhAZfeQwdHccaTJxPkW8gdLyKau5hZoLGX"
        "cwRnEZrlUWyHR5yLJu7PG9m3nnTFpBk3IUYx6O9ZdIXq+nx6j7DQe0gY9NtQKr9f"
        "Y7hdRGa44SqiCiisw/Jdp8mgidYwnc9HhP9lDHNXp0hut1pZ4a1A0SGhzhYcWcqk"
        "g+BgyT+rDzkX9ZLBJhJQWEeN/sPcco+2M4xPYkKNpBiI0XQWL5e8dgqEoytJVtIu"
        "EGe7WTYkB+ovEljxL+0uBHLopEjJMl3vt2+cXQTw+biDuWv80P3Gw53QtsJ0srWy"
        "opLA1Dk4eAuDw34qKwb5ycHJE+ykJXKSB4r9t0dFp6eCG08rOVnOn1YDzKQCTQ5N"
        "Pm1fi89wrh/6C3O/35PwYvbCfR4XDy8jiSu4hGNZ5qnCBgZu4f+R20THeyGCV1SX"
        "QnPC0vPEXGceR95/U8xwHXcqHiceq5rSwdXod3QNmHLBe+MUZo1dPOQYYQARAQAB"
        "tAZzYWRzZGGJAhwEEAECAAYFAmKjSRsACgkQEHturBgkYBHj5g//eyXKPbBRvy1W"
        "AZArUTNOW7EBl7F2rv34RS48oxhcuGekLfFryAMG8Xij2+u9Oksl3zQ4ANsMDpiQ"
        "gt2JpjflvqBqx5WTRb9An6p6ixpDXxrKPYEt5fyqUuG3C/V+cUfVKnG7mPLaZKST"
        "iy22chfyOw4zrDyLr07G9IFIA6vWt2a7vz0OurkkUPnERZs29Yj7eXgH7VZ/tPJT"
        "EmIv9sAeMggFWOscv7xNV3fm14y3FyrrbfnO51blXHZ19IgdkwIGLh3Rh7vjeU3M"
        "UE0XEq5K5OUUVR5oWyq0ROoQ/GRexddPbYX86cvGPND6UzBHjlM7QPEEtFBbwXi+"
        "i7+1QJ+/gqoLSzUQcwIEkUxrLiWvSdA2T3vZk1fhJSKPZW8/i7puAluGVPWhZJkC"
        "fqB6Jt2Sfh/Iy+zmHsJqUtwylU/Kcaq6pszokJwztAkBOWk1UVu2pN3rJMFwG8IZ"
        "z4/8PB4Rm/bj/CG7tbu5j+cc/mEcGam8yRK/E8LCysZ7U+KZpkAC2n3AOma8fqiY"
        "OXGqM/6ukJEA77PB3i//GQS1rEUjas0o3MhXCHP4D8jmjAS+BC+Ul3kc/6ZOWZ8C"
        "b7mxMunLEAMCJFXrMeg55nUFgaY5I7QoF7oSi356a07pbG2A4XCbF/affElND6LN"
        "CMOcnVMe/grOCXUHOMlWl5E9ACMyn58==1mwf"
        "-----END PGP SIGNATURE-----\n";
        TagData memory tagData = TagData({
            object: "object 872b5df418859355a69e4f8e75c1d3796154e21e\n\n",
            tagType: "type commit\n\n",
            tagName: "tag v1.0.0\n\n",
            tagger: "tagger Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n\n",
            message: "release v1.0.0\n",
            signature: signature
        });

        bytes20[] memory hashes;
        uint256[] memory values;

        vm.expectRevert(abi.encodeWithSignature("TagMsgNeedsAddr(string)", tagData.message));
        aGitConsensus.addRelease(tagData, hashes, values);
    }

    function testOk_releaseEmptyMsgAddr(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        tagDataEmpty.message = string(Utils.concat("", bytes(Strings.toHexString(tokenAddr))));

        bytes20[] memory hashes;
        uint256[] memory values;

        bytes20 tagHashExpected = mGitConsensus.addRelease(tagDataEmpty, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagDataEmpty, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }

    function testOk_releasePartialMsgAddr(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        TagData memory tagData = TagData({
            object: "object \n",
            tagType: "type \n",
            tagName: "tag \n",
            tagger: "tagger \n",
            message: string(
                Utils.concat(Utils.concat("\n", bytes(Strings.toHexString(tokenAddr))), "\n")
            ),
            signature: "\n"
        });

        bytes20[] memory hashes;
        uint256[] memory values;

        bytes20 tagHashExpected = mGitConsensus.addRelease(tagData, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagData, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }

    function testOk_releaseFilledMsgAddr(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        string memory signature = "-----BEGIN PGP SIGNATURE-----"
        ""
        "mQINBGKjSRsBEADg433Wg9tJzbes9/7mi0GvM7gTYUu9BZ9UzgxdD2nXCPQd4hSx"
        "uOBmQokTsVH8Fgr7fgkjzay78E4xr21NpJsYp5xWrsKEPUfVYnC717bhZibkliYj"
        "5N79A+EjTYPRNOGNMsPeNjTrvGwheJBSO1jcLQ/PcuzE4rSeoNn8yO/5W0POEhtZ"
        "U2MHax1L+65Cbxc2iVkQqsM3j9KUUWrhAZfeQwdHccaTJxPkW8gdLyKau5hZoLGX"
        "cwRnEZrlUWyHR5yLJu7PG9m3nnTFpBk3IUYx6O9ZdIXq+nx6j7DQe0gY9NtQKr9f"
        "Y7hdRGa44SqiCiisw/Jdp8mgidYwnc9HhP9lDHNXp0hut1pZ4a1A0SGhzhYcWcqk"
        "g+BgyT+rDzkX9ZLBJhJQWEeN/sPcco+2M4xPYkKNpBiI0XQWL5e8dgqEoytJVtIu"
        "EGe7WTYkB+ovEljxL+0uBHLopEjJMl3vt2+cXQTw+biDuWv80P3Gw53QtsJ0srWy"
        "opLA1Dk4eAuDw34qKwb5ycHJE+ykJXKSB4r9t0dFp6eCG08rOVnOn1YDzKQCTQ5N"
        "Pm1fi89wrh/6C3O/35PwYvbCfR4XDy8jiSu4hGNZ5qnCBgZu4f+R20THeyGCV1SX"
        "QnPC0vPEXGceR95/U8xwHXcqHiceq5rSwdXod3QNmHLBe+MUZo1dPOQYYQARAQAB"
        "tAZzYWRzZGGJAhwEEAECAAYFAmKjSRsACgkQEHturBgkYBHj5g//eyXKPbBRvy1W"
        "AZArUTNOW7EBl7F2rv34RS48oxhcuGekLfFryAMG8Xij2+u9Oksl3zQ4ANsMDpiQ"
        "gt2JpjflvqBqx5WTRb9An6p6ixpDXxrKPYEt5fyqUuG3C/V+cUfVKnG7mPLaZKST"
        "iy22chfyOw4zrDyLr07G9IFIA6vWt2a7vz0OurkkUPnERZs29Yj7eXgH7VZ/tPJT"
        "EmIv9sAeMggFWOscv7xNV3fm14y3FyrrbfnO51blXHZ19IgdkwIGLh3Rh7vjeU3M"
        "UE0XEq5K5OUUVR5oWyq0ROoQ/GRexddPbYX86cvGPND6UzBHjlM7QPEEtFBbwXi+"
        "i7+1QJ+/gqoLSzUQcwIEkUxrLiWvSdA2T3vZk1fhJSKPZW8/i7puAluGVPWhZJkC"
        "fqB6Jt2Sfh/Iy+zmHsJqUtwylU/Kcaq6pszokJwztAkBOWk1UVu2pN3rJMFwG8IZ"
        "z4/8PB4Rm/bj/CG7tbu5j+cc/mEcGam8yRK/E8LCysZ7U+KZpkAC2n3AOma8fqiY"
        "OXGqM/6ukJEA77PB3i//GQS1rEUjas0o3MhXCHP4D8jmjAS+BC+Ul3kc/6ZOWZ8C"
        "b7mxMunLEAMCJFXrMeg55nUFgaY5I7QoF7oSi356a07pbG2A4XCbF/affElND6LN"
        "CMOcnVMe/grOCXUHOMlWl5E9ACMyn58==1mwf"
        "-----END PGP SIGNATURE-----\n";
        TagData memory tagData = TagData({
            object: "object 872b5df418859355a69e4f8e75c1d3796154e21e\n\n",
            tagType: "type commit\n\n",
            tagName: "tag v1.0.0\n\n",
            tagger: "tagger Satoshi Nakamoto <satoshi@bitcoin.org> 1208691178 -0400\n\n",
            message: string(
                Utils.concat(
                    Utils.concat("release v1.0.0", bytes(Strings.toHexString(tokenAddr))),
                    "\n"
                )
            ),
            signature: signature
        });

        bytes20[] memory hashes;
        uint256[] memory values;
        bytes20 tagHashExpected = mGitConsensus.addRelease(tagData, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagData, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }

    function testOk_releaseTwoHashDiffMsgStrNotMatch(bytes32 _tokenSalt, bytes32 _govSalt) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        TagData memory tagData1 = TagData({
            object: "object hello\n",
            tagType: "type \n",
            tagName: "tag \n",
            tagger: "tagger \n",
            message: string(
                Utils.concat(Utils.concat("\nhello", bytes(Strings.toHexString(tokenAddr))), "\n")
            ),
            signature: "\n"
        });

        bytes20[] memory hashes1;
        uint256[] memory values1;
        TagData memory tagData2 = TagData({
            object: "object \n",
            tagType: "type \n",
            tagName: "tag \n",
            tagger: "tagger \n",
            message: string(
                Utils.concat(Utils.concat("\ngoodbye", bytes(Strings.toHexString(tokenAddr))), "\n")
            ),
            signature: "\n"
        });

        bytes20[] memory hashes2;
        uint256[] memory values2;

        bytes20 tagHashExpected1 = mGitConsensus.addRelease(tagData1, hashes1, values1);
        bytes20 tagHashExpected2 = mGitConsensus.addRelease(tagData2, hashes2, values2);

        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected1);
        bytes20 commitHash1 = aGitConsensus.addRelease(tagData1, hashes1, values1);

        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected2);
        bytes20 commitHash2 = aGitConsensus.addRelease(tagData2, hashes2, values2);

        assertTrue(aGitConsensus.tagExists(commitHash1));
        assertTrue(aGitConsensus.tagExists(commitHash2));

        assertFalse(commitHash2 == commitHash1);
    }

    function testOk_releaseDistributionSizeDiffFails(
        bytes32 _tokenSalt,
        bytes32 _govSalt,
        bytes20 _randHash
    ) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);

        tagDataEmpty.message = string(Utils.concat("", bytes(Strings.toHexString(tokenAddr))));
        bytes20[] memory hashes = new bytes20[](1);
        uint256[] memory values = new uint256[](0);
        hashes[0] = _randHash;

        vm.expectRevert(
            abi.encodeWithSignature(
                "DistributionLengthMismatch(uint256,uint256)",
                hashes.length,
                values.length
            )
        );
        mGitConsensus.addRelease(tagDataEmpty, hashes, values);
    }

    function testOk_releaseStaticDistribution(
        bytes32 _tokenSalt,
        bytes32 _govSalt,
        uint256 _distributionValue,
        uint256 _distributionLength
    ) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        tagDataEmpty.message = string(Utils.concat("", bytes(Strings.toHexString(tokenAddr))));
        (bytes20[] memory hashes, uint256[] memory values) = Distibution
            .newStaticReleaseDistribution(_distributionValue, _distributionLength);

        bytes20 tagHashExpected = mGitConsensus.addRelease(tagDataEmpty, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagDataEmpty, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }

    function testOk_releaseRandomDistribution(
        bytes32 _tokenSalt,
        bytes32 _govSalt,
        uint256 _distributionValue,
        uint256 _distributionLength,
        bytes32 _distributionSalt
    ) public {
        (address tokenAddr, address govAddr) = createTokenGovPair(_tokenSalt, _govSalt);
        vm.assume(tokenAddr != address(0));
        vm.startPrank(govAddr);
        vm.assume(_distributionValue < type(uint224).max);
        vm.assume(_distributionLength < 10000);

        tagDataEmpty.message = string(Utils.concat("", bytes(Strings.toHexString(tokenAddr))));
        (bytes20[] memory hashes, uint256[] memory values) = Distibution
            .newRandomReleaseDistribution(
                _distributionValue,
                _distributionLength,
                _distributionSalt
            );

        bytes20 tagHashExpected = mGitConsensus.addRelease(tagDataEmpty, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagDataEmpty, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }
}

contract GasBenchmark is BaseSetup {
    // A real token<->address pair needs to be set up, otherwise the addRelease() call
    // will recieve an UnauthorizedRelease() error.
    address tokenAddr;
    address govAddr;

    function setUp() public virtual override {
        super.setUp();
        (tokenAddr, govAddr) = createTokenGovPair("foo", "bar");
    }

    function testGas_commit() public {
        string memory message = string(
            Utils.concat(
                Utils.concat(
                    "\nblahblahblahblahblahblahblahblahblahblahblahblah ",
                    bytes(Strings.toHexString(alice))
                ),
                "\n"
            )
        );
        commitDataEmpty.message = message;

        bytes20 commitHashExpected = mGitConsensus.addCommit(commitDataEmpty);
        assertFalse(aGitConsensus.commitExists(commitHashExpected));
        assertEq(address(0), aGitConsensus.commitAddr(commitHashExpected));

        vm.expectEmit(true, false, false, true);
        emit CommitAdded(alice, commitHashExpected);

        bytes20 commitHash = aGitConsensus.addCommit(commitDataEmpty);
        assertTrue(aGitConsensus.commitExists(commitHash));
        assertEq(alice, aGitConsensus.commitAddr(commitHash));
        assertEq(commitHashExpected, commitHash);
    }

    function testGas_release() public {
        vm.startPrank(govAddr);
        string memory message = string(
            Utils.concat(
                Utils.concat(
                    "\nblahblahblahblahblahblahblahblahblahblahblahblah",
                    bytes(Strings.toHexString(tokenAddr))
                ),
                "\n"
            )
        );
        tagDataEmpty.message = message;

        bytes20[] memory hashes;
        uint256[] memory values;

        bytes20 tagHashExpected = mGitConsensus.addRelease(tagDataEmpty, hashes, values);
        vm.expectEmit(true, false, false, false);
        emit ReleaseAdded(tokenAddr, tagHashExpected);
        bytes20 tagHash = aGitConsensus.addRelease(tagDataEmpty, hashes, values);
        assertEq(tokenAddr, aGitConsensus.tagAddr(tagHash));
        assertTrue(aGitConsensus.tagExists(tagHash));
    }
}
