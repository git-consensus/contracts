// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {IGitConsensusTypes} from "../../interfaces/IGitConsensus.sol";

/// @title  Distribution
/// @notice Utility functions for working with IGitConsensus distributions - the method of
///         distributing tokens to some number of of addresses. In the case of InitialDistribution*
///         methods, the distribution is an array of addresses and values. In the case of the
///         ReleaseDistribution* methods, the distribution is an array of git hashes and owners.
library Distibution {
    /// @dev Creates a distrubution with # of owners and value determined by `_length`.
    ///   Divides value portions equally among owners (e.g. 4 owners get 25% each).
    function newStaticInitialDistribution(uint256 _value, uint256 _length)
        internal
        pure
        returns (address[] memory owners_, uint256[] memory values_)
    {
        owners_ = new address[](_length);
        values_ = new uint256[](_length);

        bytes32 nextOwner = keccak256(abi.encodePacked("user address"));
        for (uint256 i = 0; i < _length; i++) {
            owners_[i] = address(uint160(uint256(nextOwner)));

            uint256 portion = 100 / _length;
            uint256 ownerValue = (_value * portion) / 100;
            values_[i] = ownerValue;

            nextOwner = keccak256(abi.encodePacked(nextOwner));
        }
    }

    /// @dev Creates a distrubution with max # of owners and value determined by `_maxLength`.
    ///   Each owner's value will be randomly generated, and will sum to 100%.
    function newRandomInitialDistribution(
        uint256 _value,
        uint256 _maxLength,
        bytes32 _salt
    ) internal view returns (address[] memory owners_, uint256[] memory values_) {
        address[] memory tempOwners = new address[](_maxLength);
        uint256[] memory tempValues = new uint256[](_maxLength);

        uint256 usedIdx = 0;
        uint256 totalPortions = 0;
        bytes32 nextOwner = keccak256(abi.encodePacked("user address"));
        for (uint256 i = 0; i < _maxLength; i++) {
            tempOwners[i] = address(uint160(uint256(nextOwner)));

            uint256 randPortion = generateRandomPortion(100, _salt);
            totalPortions += randPortion;

            bool full = false;
            if (totalPortions >= 100) {
                randPortion = randPortion - (totalPortions % 100);
                full = true;
            }

            uint256 ownerValue = (_value * randPortion) / 100;
            tempValues[i] = ownerValue;

            nextOwner = keccak256(abi.encodePacked(nextOwner));

            if (full) {
                usedIdx = i + 1;
                break;
            }
        }

        // Don't need unassigned indexes, since maxLength not achieved and don't want 0 addrs
        owners_ = new address[](usedIdx);
        values_ = new uint256[](usedIdx);
        for (uint256 i = 0; i < usedIdx; i++) {
            owners_[i] = tempOwners[i];
            values_[i] = tempValues[i];
        }
    }

    /// @dev Creates a distrubution with # of hashes and value determined by `_length`.
    ///   Divides value portions equally among hashes (e.g. 4 commit hash owners get 25% each).
    function newStaticReleaseDistribution(uint256 _value, uint256 _length)
        internal
        pure
        returns (bytes20[] memory hashes_, uint256[] memory values_)
    {
        hashes_ = new bytes20[](_length);
        values_ = new uint256[](_length);

        bytes32 nextHash = keccak256(abi.encodePacked("git commit hash"));
        for (uint256 i = 0; i < _length; i++) {
            hashes_[i] = bytes20(uint160(uint256(nextHash)));

            uint256 portion = 100 / _length;
            uint256 ownerValue = (_value * portion) / 100;
            values_[i] = ownerValue;

            nextHash = keccak256(abi.encodePacked(nextHash));
        }
    }

    /// @dev Creates a distrubution with max # of owners and value determined by `_maxLength`.
    ///   Each owner's value will be randomly generated, and will sum to 100%.
    function newRandomReleaseDistribution(
        uint256 _value,
        uint256 _maxLength,
        bytes32 _salt
    ) internal view returns (bytes20[] memory hashes_, uint256[] memory values_) {
        bytes20[] memory tempHashes = new bytes20[](_maxLength);
        uint256[] memory tempValues = new uint256[](_maxLength);

        uint256 usedIdx = 0;
        uint256 totalPortions = 0;
        bytes32 nextHash = keccak256(abi.encodePacked("git commit hash"));
        for (uint256 i = 0; i < _maxLength; i++) {
            tempHashes[i] = bytes20(uint160(uint256(nextHash)));

            uint256 randPortion = generateRandomPortion(100, _salt);
            totalPortions += randPortion;

            bool full = false;
            if (totalPortions >= 100) {
                randPortion = randPortion - (totalPortions % 100);
                full = true;
            }

            uint256 ownerValue = (_value * randPortion) / 100;
            tempValues[i] = ownerValue;

            nextHash = keccak256(abi.encodePacked(nextHash));

            if (full) {
                usedIdx = i + 1;
                break;
            }
        }

        // don't included unassigned indexes, since maxLength not achieved and don't want 0 addrs
        hashes_ = new bytes20[](usedIdx);
        values_ = new uint256[](usedIdx);
        for (uint256 i = 0; i < usedIdx; i++) {
            hashes_[i] = tempHashes[i];
            values_[i] = tempValues[i];
        }
    }

    function generateRandomPortion(uint256 _max, bytes32 _salt)
        internal
        view
        returns (uint256 rand_)
    {
        return
            (uint256(keccak256(abi.encodePacked(block.difficulty, block.timestamp, _salt))) %
                _max) + 1;
    }
}
