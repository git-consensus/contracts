// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGitConsensus} from "./interfaces/IGitConsensus.sol";
import {IToken} from "./interfaces/IToken.sol";
import {Utils} from "./lib/Utils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title  GitConsensus
/// @author Matt Stam (@mattstam)
/// @notice A Git Consensus Protocol implementation.
contract GitConsensus is IGitConsensus {
    /// @dev To parse address in commit/tag message, look for 0x followed by 40 hex characters
    uint8 constant ADDR_BYTES_LENGTH = 42;

    mapping(bytes20 => address) private commitToOwnerAddr;
    mapping(bytes20 => address) private tagToTokenAddr;

    /// @inheritdoc IGitConsensus
    function addCommit(CommitData calldata _commitData) external returns (bytes20 commitHash_) {
        // build SHA-1 hash based on commit data: sha1("commit " + datasize + "\0" + data)
        string memory data = string(
            abi.encodePacked(
                _commitData.tree,
                _commitData.parents,
                _commitData.author,
                _commitData.committer,
                _commitData.signature,
                _commitData.message,
                ""
            )
        );
        commitHash_ = Utils.sha1(
            abi.encodePacked("commit ", Strings.toString(bytes(data).length), bytes1(0), data)
        );

        // parse the owner's address that is embedded in the message
        if (bytes(_commitData.message).length < ADDR_BYTES_LENGTH) {
            revert CommitMsgNeedsAddr(_commitData.message);
        }
        uint256 addrOffset = Utils.indexOfAddr(_commitData.message);
        string memory addrStr = Utils.substring(_commitData.message, addrOffset, ADDR_BYTES_LENGTH);
        address ownerAddr = Utils.parseAddr(addrStr);

        commitToOwnerAddr[commitHash_] = ownerAddr;

        emit CommitAdded(ownerAddr, commitHash_);
    }

    /// @inheritdoc IGitConsensus
    function addRelease(
        TagData calldata _tagData,
        bytes20[] calldata _hashes,
        uint256[] calldata _values
    ) external returns (bytes20 tagHash_) {
        if (_hashes.length != _values.length) {
            revert DistributionLengthMismatch(_hashes.length, _values.length);
        }

        // build SHA-1 hash based on tag data: sha1("tag " + datasize + "\0" + data)
        string memory data = string(
            abi.encodePacked(
                _tagData.object,
                _tagData.tagType,
                _tagData.tagName,
                _tagData.tagger,
                _tagData.message,
                _tagData.signature,
                ""
            )
        );
        tagHash_ = Utils.sha1(
            abi.encodePacked("tag ", Strings.toString(bytes(data).length), bytes1(0), data)
        );

        // parse the token's address that is embedded in the message
        if (bytes(_tagData.message).length < ADDR_BYTES_LENGTH) {
            revert TagMsgNeedsAddr(_tagData.message);
        }
        uint256 addrOffset = Utils.indexOfAddr(_tagData.message);
        string memory addrStr = Utils.substring(_tagData.message, addrOffset, ADDR_BYTES_LENGTH);
        address tokenAddr = Utils.parseAddr(addrStr);

        IToken token = IToken(tokenAddr);

        // ensure that the caller of the function is the token's governor
        if (token.governor() != msg.sender) {
            revert UnauthorizedRelease(msg.sender, token.governor());
        }

        // mint new tokens for each commit owner
        for (uint256 i = 0; i < _hashes.length; ++i) {
            bytes20 commitHash = _hashes[i];
            address owner = commitToOwnerAddr[commitHash];
            uint256 value = _values[i];

            // Could choose to check if `commitToOwnerAddr[commitHash] != address(0)` to
            // enforce that ALL commit hashes in the release MUST be in the distribution hashes.
            // Instead, we skip over any commits that aren't saved on-chain.
            // Rationale is that this makes it easier to go from tag(n-1) to tag(n)
            // without having to worry about commits that haven't included an address or
            // called the contract, but it would still be nice to have somehow inform people
            // that "this commit's value is being ignored due to not having a valid address".

            if (value == 0 || owner == address(0)) {
                continue;
            }

            token.mint(owner, value);
        }

        tagToTokenAddr[tagHash_] = tokenAddr;

        emit ReleaseAdded(tokenAddr, tagHash_);
    }

    /// @inheritdoc IGitConsensus
    function commitAddr(bytes20 _commitHash) external view returns (address ownerAddr_) {
        return commitToOwnerAddr[_commitHash];
    }

    /// @inheritdoc IGitConsensus
    function commitExists(bytes20 _commitHash) external view returns (bool exists_) {
        return commitToOwnerAddr[_commitHash] != address(0);
    }

    /// @inheritdoc IGitConsensus
    function tagAddr(bytes20 _tagHash) external view returns (address tokenAddr_) {
        return tagToTokenAddr[_tagHash];
    }

    /// @inheritdoc IGitConsensus
    function tagExists(bytes20 _tagHash) external view returns (bool exists_) {
        return tagToTokenAddr[_tagHash] != address(0);
    }
}
