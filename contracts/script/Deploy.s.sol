// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WhiskyCaskVault} from "../src/WhiskyCaskVault.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeployScript {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (WhiskyCaskVault vault) {
        VM.startBroadcast();
        vault = new WhiskyCaskVault();
        VM.stopBroadcast();
    }
}
