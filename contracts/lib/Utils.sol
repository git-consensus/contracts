// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title  Utils
/// @notice A collection of utility functions for Git Consensus.
/// @dev    These mostly are for string utility, type conversions (string -> address)
///         and other misc. functions like SHA1 hashing. Should be gas-optimized, but
///         not necessarily optimized for readability. Improvements to gas efficiency
///         are always welcome.
library Utils {
    /// @notice Locates and returns the char position of the first "0x" within a string.
    /// @param _base String to search through.
    /// @return pos_ The position of the first "0x". Failure to find "0x" will return 0,
    ///     but 0 can also be a legitmate value if the address was first in _base.
    /// @dev This is a hacky method and does not guarantee that that just because "0x"
    ///     exists, that it actually indicates an intended address. A user could use "0x"
    ///     in their commit message for other reasons, but we will fail later on during the
    ///     address conversion.
    ///
    ///     Start from the back because standard usage for GitConsensus will have the
    ///     address appended to the end of the commit message.
    function indexOfAddr(string memory _base) internal pure returns (uint256 pos_) {
        bytes memory _baseBytes = bytes(_base);

        for (uint256 i = _baseBytes.length - 2; i >= 0; --i) {
            if (_baseBytes[i] == "0" && _baseBytes[i + 1] == "x") {
                return i;
            }
        }

        return 0;
    }

    /// @notice Extracts the part of a string based on the desired length and offset.
    ///     The offset and length must not exceed the length of the base string.
    /// @param _base When being used for a data type this is the extended object
    ///     otherwise this is the string that will be used for extracting the substring.
    /// @param _offset The starting point to extract the substring from.
    /// @param _length The length of the substring to be extracted from the base.
    /// @return result_ The extracted substring.
    function substring(
        string memory _base,
        uint256 _offset,
        uint256 _length
    ) internal pure returns (string memory result_) {
        bytes memory _baseBytes = bytes(_base);

        (bool success, uint256 endIdx) = SafeMath.tryAdd(_offset, _length);
        require(success, "Utils: substring overflow");
        require(endIdx <= _baseBytes.length , "Utils: substring out of bounds");

        string memory _tmp = new string(_length);
        bytes memory _tmpBytes = bytes(_tmp);

        uint256 j = 0;
        for (uint256 i = _offset; i < endIdx; i++) {
            _tmpBytes[j++] = _baseBytes[i];
        }

        return string(_tmpBytes);
    }

    /// @notice Converts a string representation of an address (e.g. "0x...123" to an address).
    /// @param _addrStr The string representation of the address to be converted.
    /// @return _addr The address represented by the string.
    /// @dev If user passes in '0x' but not a full address, we will interpret the next 20 bytes
    ///     as a real address, and it will fail in this function with a ambigious error message:
    ///     "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside
    ///     of an unchecked block)"
    ///     TODO: Try and catch this error and return a more meaningful error message
    ///     src: https://github.com/provable-things/ethereum-api/
    ///          blob/94b49f1b65ec4c0465b0e9f49f00415e5ed001a1/contracts/
    ///          solc-v0.8.x/provableAPI.sol#L631
    function parseAddr(string memory _addrStr) internal pure returns (address _addr) {
        bytes memory tmp = bytes(_addrStr);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 65) && (b1 <= 70)) {
                b1 -= 55;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 65) && (b2 <= 70)) {
                b2 -= 55;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    /// @notice A SHA-1 hash function for bytes.
    /// @param _data The data to hash.
    /// @return hash_ The hash of the data.
    /// @dev src: https://github.com/ensdomains/solsha1/blob/master/contracts/SHA1.sol
    ///     by by Nick Johnson (Arachnid)
    function sha1(bytes memory _data) internal pure returns (bytes20 hash_) {
        assembly {
            // Get a safe scratch location
            let scratch := mload(0x40)

            // Get the data length, and point data at the first byte
            let len := mload(_data)
            _data := add(_data, 32)

            // Find the length after padding
            let totallen := add(and(add(len, 1), 0xFFFFFFFFFFFFFFC0), 64)
            switch lt(sub(totallen, len), 9)
            case 1 {
                totallen := add(totallen, 64)
            }

            let h := 0x6745230100EFCDAB890098BADCFE001032547600C3D2E1F0

            function readword(ptr, off, count) -> result {
                result := 0
                if lt(off, count) {
                    result := mload(add(ptr, off))
                    count := sub(count, off)
                    if lt(count, 32) {
                        let mask := not(sub(exp(256, sub(32, count)), 1))
                        result := and(result, mask)
                    }
                }
            }

            for {
                let i := 0
            } lt(i, totallen) {
                i := add(i, 64)
            } {
                mstore(scratch, readword(_data, i, len))
                mstore(add(scratch, 32), readword(_data, add(i, 32), len))

                // If we loaded the last byte, store the terminator byte
                switch lt(sub(len, i), 64)
                case 1 {
                    mstore8(add(scratch, sub(len, i)), 0x80)
                }

                // If this is the last block, store the length
                switch eq(i, sub(totallen, 64))
                case 1 {
                    mstore(add(scratch, 32), or(mload(add(scratch, 32)), mul(len, 8)))
                }

                // Expand the 16 32-bit words into 80
                for {
                    let j := 64
                } lt(j, 128) {
                    j := add(j, 12)
                } {
                    let temp := xor(
                        xor(mload(add(scratch, sub(j, 12))), mload(add(scratch, sub(j, 32)))),
                        xor(mload(add(scratch, sub(j, 56))), mload(add(scratch, sub(j, 64))))
                    )
                    temp := or(
                        and(
                            mul(temp, 2),
                            0xFFFFFFFEFFFFFFFEFFFFFFFEFFFFFFFEFFFFFFFEFFFFFFFEFFFFFFFEFFFFFFFE
                        ),
                        and(
                            div(temp, 0x80000000),
                            0x0000000100000001000000010000000100000001000000010000000100000001
                        )
                    )
                    mstore(add(scratch, j), temp)
                }
                for {
                    let j := 128
                } lt(j, 320) {
                    j := add(j, 24)
                } {
                    let temp := xor(
                        xor(mload(add(scratch, sub(j, 24))), mload(add(scratch, sub(j, 64)))),
                        xor(mload(add(scratch, sub(j, 112))), mload(add(scratch, sub(j, 128))))
                    )
                    temp := or(
                        and(
                            mul(temp, 4),
                            0xFFFFFFFCFFFFFFFCFFFFFFFCFFFFFFFCFFFFFFFCFFFFFFFCFFFFFFFCFFFFFFFC
                        ),
                        and(
                            div(temp, 0x40000000),
                            0x0000000300000003000000030000000300000003000000030000000300000003
                        )
                    )
                    mstore(add(scratch, j), temp)
                }

                let x := h
                let f := 0
                let k := 0
                for {
                    let j := 0
                } lt(j, 80) {
                    j := add(j, 1)
                } {
                    switch div(j, 20)
                    case 0 {
                        // f = d xor (b and (c xor d))
                        f := xor(div(x, 0x100000000000000000000), div(x, 0x10000000000))
                        f := and(div(x, 0x1000000000000000000000000000000), f)
                        f := xor(div(x, 0x10000000000), f)
                        k := 0x5A827999
                    }
                    case 1 {
                        // f = b xor c xor d
                        f := xor(
                            div(x, 0x1000000000000000000000000000000),
                            div(x, 0x100000000000000000000)
                        )
                        f := xor(div(x, 0x10000000000), f)
                        k := 0x6ED9EBA1
                    }
                    case 2 {
                        // f = (b and c) or (d and (b or c))
                        f := or(
                            div(x, 0x1000000000000000000000000000000),
                            div(x, 0x100000000000000000000)
                        )
                        f := and(div(x, 0x10000000000), f)
                        f := or(
                            and(
                                div(x, 0x1000000000000000000000000000000),
                                div(x, 0x100000000000000000000)
                            ),
                            f
                        )
                        k := 0x8F1BBCDC
                    }
                    case 3 {
                        // f = b xor c xor d
                        f := xor(
                            div(x, 0x1000000000000000000000000000000),
                            div(x, 0x100000000000000000000)
                        )
                        f := xor(div(x, 0x10000000000), f)
                        k := 0xCA62C1D6
                    }
                    // temp = (a leftrotate 5) + f + e + k + w[i]
                    let temp := and(div(x, 0x80000000000000000000000000000000000000000000000), 0x1F)
                    temp := or(
                        and(div(x, 0x800000000000000000000000000000000000000), 0xFFFFFFE0),
                        temp
                    )
                    temp := add(f, temp)
                    temp := add(and(x, 0xFFFFFFFF), temp)
                    temp := add(k, temp)
                    temp := add(
                        div(
                            mload(add(scratch, mul(j, 4))),
                            0x100000000000000000000000000000000000000000000000000000000
                        ),
                        temp
                    )
                    x := or(
                        div(x, 0x10000000000),
                        mul(temp, 0x10000000000000000000000000000000000000000)
                    )
                    x := or(
                        and(x, 0xFFFFFFFF00FFFFFFFF000000000000FFFFFFFF00FFFFFFFF),
                        mul(
                            or(
                                and(div(x, 0x4000000000000), 0xC0000000),
                                and(div(x, 0x400000000000000000000), 0x3FFFFFFF)
                            ),
                            0x100000000000000000000
                        )
                    )
                }

                h := and(add(h, x), 0xFFFFFFFF00FFFFFFFF00FFFFFFFF00FFFFFFFF00FFFFFFFF)
            }
            hash_ := mul(
                or(
                    or(
                        or(
                            or(
                                and(
                                    div(h, 0x100000000),
                                    0xFFFFFFFF00000000000000000000000000000000
                                ),
                                and(div(h, 0x1000000), 0xFFFFFFFF000000000000000000000000)
                            ),
                            and(div(h, 0x10000), 0xFFFFFFFF0000000000000000)
                        ),
                        and(div(h, 0x100), 0xFFFFFFFF00000000)
                    ),
                    and(h, 0xFFFFFFFF)
                ),
                0x1000000000000000000000000
            )
        }
    }
}
