// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGitConsensus} from "./interfaces/IGitConsensus.sol";
import {Utils} from "./lib/Utils.sol";

/// @title  GitConsensus
/// @author Matt Stam (@mattstam)
/// @notice A Git Consensus Protocol implementation.
contract GitConsensus is IGitConsensus {
    /// @dev To parse address in commit/tag message, look for 0x followed by 40 hex characters
    uint256 constant ADDR_BYTES_LENGTH = 42;

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
            abi.encodePacked("commit ", Utils.uintToStr(bytes(data).length), bytes1(0), data)
        );

        // parse the owner's address that is embedded in the message
        if (bytes(_commitData.message).length < ADDR_BYTES_LENGTH) {
            revert MsgNeedsAddr();
        }
        uint256 ownerAddrOffset = Utils.indexOfAddr(_commitData.message);
        string memory ownerAddrStr = Utils.substring(
            _commitData.message,
            ownerAddrOffset,
            ADDR_BYTES_LENGTH
        );
        address ownerAddr = Utils.parseAddr(ownerAddrStr);

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
            revert DistributionLengthMismatch();
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
            abi.encodePacked("tag ", Utils.uintToStr(bytes(data).length), bytes1(0), data)
        );

        // parse the token's address that is embedded in the message
        if (bytes(_tagData.message).length < ADDR_BYTES_LENGTH) {
            revert MsgNeedsAddr();
        }
        uint256 tokenAddrOffset = Utils.indexOfAddr(_tagData.message);
        string memory tokenAddrStr = Utils.substring(
            _tagData.message,
            tokenAddrOffset,
            ADDR_BYTES_LENGTH
        );
        address tokenAddr = Utils.parseAddr(tokenAddrStr);

        tagToTokenAddr[tagHash_] = tokenAddr;

        // TODO: check msg.sender is governor, get reference to token, and mint tokens
        // for each hash in _hashes.

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
