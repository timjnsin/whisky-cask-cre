// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiskyCaskVault} from "../src/WhiskyCaskVault.sol";

contract DeployScript {
    function run() external returns (WhiskyCaskVault vault) {
        vault = new WhiskyCaskVault();
    }
}
