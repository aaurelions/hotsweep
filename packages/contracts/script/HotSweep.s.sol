// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HotSweep} from "../src/HotSweep.sol";

contract HotSweepScript is Script {
    function run() public {
        vm.startBroadcast();

        HotSweep hotSweep = new HotSweep(msg.sender);

        vm.stopBroadcast();

        console.log("HotSweep deployed at:", address(hotSweep));
        console.log("Owner address:", msg.sender);
    }
}
