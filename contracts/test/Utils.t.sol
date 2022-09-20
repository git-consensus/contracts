// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;
import {Test} from "./utils/Test.sol";
import {Utils as LibUtils} from "../lib/Utils.sol";
import {IGitConsensusErrors} from "../interfaces/IGitConsensus.sol";

contract UtilsTest is Test, IGitConsensusErrors {
    string private constant ADDR_STR = "0xC257274276a4E539741Ca11b590B9447B26A8051";
    address private constant ADDR = 0xC257274276a4E539741Ca11b590B9447B26A8051;
    string private constant COMMIT_MSG_BASE = "Lorem ipsum dolor sit amet.";
    string private constant COMMIT_MSG = "Lorem ipsum dolor sit amet.0xC257274276a4E539741Ca11b590B9447B26A8051";
    uint256 private constant MAX_UINT256 = 2**256 - 1;
    uint8 private constant ADDR_STR_LENGTH = 42;

    function testOk_indexOfAddressTrivialCase() public {
        assertEq(LibUtils.indexOfAddr(ADDR_STR), 0);
    }

    function testOk_indexOfAddressGeneralCase() public {
        assertEq(LibUtils.indexOfAddr(COMMIT_MSG), bytes(COMMIT_MSG_BASE).length);
    }

    function testOk_indexOfAddressNonexistentADDR_STREmptyMsg() public {
        assertEq("", 0);
    }

    function testOk_indexOfAddrNonexistentADDR_STRNonemptyMsg() public {
        assertEq(LibUtils.indexOfAddr(COMMIT_MSG_BASE), 0);
    }

    function testOk_substringGeneralCase() public {
        assertEq(ADDR_STR, LibUtils.substring(COMMIT_MSG, LibUtils.indexOfAddr(COMMIT_MSG), ADDR_STR_LENGTH));
    }

    function testOk_substringEntireString() public {
        assertEq(ADDR_STR, LibUtils.substring(ADDR_STR, 0, ADDR_STR_LENGTH));
    }

    function testOk_substringEmptyString() public {
        assertEq("", LibUtils.substring(ADDR_STR, 0, 0));
    }

    function testOk_substringOutOfBoundsNoOverflow() public {
        vm.expectRevert(
            abi.encodeWithSelector(SubstringOutOfBounds.selector, bytes(COMMIT_MSG).length,
            bytes(COMMIT_MSG).length, bytes(COMMIT_MSG).length)
        );
        LibUtils.substring(COMMIT_MSG, bytes(COMMIT_MSG).length, bytes(COMMIT_MSG).length);
    }

    function testOk_substringOutOfBoundsOverflow() public {
          vm.expectRevert(
            abi.encodeWithSelector(SubstringOutOfBounds.selector, 1,
            MAX_UINT256, bytes(COMMIT_MSG).length)
        );
        LibUtils.substring(COMMIT_MSG, 1, MAX_UINT256);
    }

    function testOK_parseAddrGeneralCase() public {
        assertEq(LibUtils.parseAddr(ADDR_STR), ADDR);
    }
}
