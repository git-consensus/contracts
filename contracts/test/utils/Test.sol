// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.17;

import {DSTest} from "@float-capital/ds-test/src/test.sol";
import {Vm} from "./Vm.sol";

/// @title Test
/// @notice Wrapping the DSTest framework for extending the functionality.
contract Test is DSTest {
    Vm public vm = Vm(HEVM_ADDRESS);

    function fail(string memory _err) internal virtual {
        emit log_named_string("Error", _err);
        fail();
    }

    function assertFalse(bool _data) internal virtual {
        assertTrue(!_data);
    }
}
