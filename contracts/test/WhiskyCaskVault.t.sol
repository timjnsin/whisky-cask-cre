// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiskyCaskVault} from "../src/WhiskyCaskVault.sol";

contract WhiskyCaskVaultTest {
    function testPlaceholder() external pure returns (bool) {
        return true;
    }

    function deployForManualTesting() external returns (WhiskyCaskVault vault) {
        vault = new WhiskyCaskVault();
    }
}
