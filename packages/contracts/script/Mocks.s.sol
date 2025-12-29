// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockLGCY, MockDLGT, MockUSDC, MockPRMT} from "../src/Mocks.sol";

contract MocksScript is Script {
    function run() public {
        vm.startBroadcast();

        MockLGCY lgcy = new MockLGCY();
        MockDLGT dlgt = new MockDLGT();
        MockUSDC usdc = new MockUSDC();
        MockPRMT prmt = new MockPRMT();

        vm.stopBroadcast();

        console.log("LGCY deployed at:", address(lgcy));
        console.log("DLGT deployed at:", address(dlgt));
        console.log("USDC deployed at:", address(usdc));
        console.log("PRMT deployed at:", address(prmt));
    }
}
