// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HotSweep as Sweep} from "../src/HotSweep.sol";
import {HotSweepScript as SweepScript} from "../script/HotSweep.s.sol";
import {MockLGCY, MockDLGT, MockPRMT, MockUSDC} from "../src/Mocks.sol";

contract HotSweepScriptTest is Test {
    SweepScript sweepScript;

    function setUp() public {
        sweepScript = new SweepScript();
    }

    function test_SweepScript() public {
        sweepScript.run();
    }
}

contract HotSweepTest is Test {
    Sweep public sweep;
    MockLGCY public lgcyToken;
    MockDLGT public dlgtToken;
    MockPRMT public prmtToken;
    MockUSDC public usdcToken;

    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public recipient = address(0x4);

    uint256 public user1PrivateKey = 0xA11CE;
    uint256 public user2PrivateKey = 0xB0B;

    function setUp() public {
        sweep = new Sweep(owner);
        lgcyToken = new MockLGCY();
        dlgtToken = new MockDLGT();
        prmtToken = new MockPRMT();
        usdcToken = new MockUSDC();

        lgcyToken.mint(user1, 1000 ether);
        dlgtToken.mint(user1, 1000 ether);
        prmtToken.mint(user1, 1000 ether);
        usdcToken.mint(user1, 1000e6);

        vm.deal(address(sweep), 10 ether);
    }

    // ==================== Helper Functions ====================

    function _createPermitSignature(
        address tokenOwner,
        uint256 privateKey,
        uint256 amount,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                tokenOwner,
                address(sweep),
                amount,
                prmtToken.nonces(tokenOwner),
                deadline
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                prmtToken.DOMAIN_SEPARATOR(),
                structHash
            )
        );

        return vm.sign(privateKey, digest);
    }

    function _createAuthSignature(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                usdcToken.DOMAIN_SEPARATOR(),
                structHash
            )
        );

        return vm.sign(privateKey, digest);
    }

    // ==================== Constructor Tests ====================

    function testConstructor() public view {
        assertEq(sweep.owner(), owner);
    }

    function testConstructorSetsImmutableOwner() public {
        Sweep newSweep = new Sweep(user1);
        assertEq(newSweep.owner(), user1);
    }

    // ==================== Owner Tests ====================

    function testOwnerReturnsImmutableOwner() public view {
        assertEq(sweep.owner(), owner);
    }

    function testTransferOwnershipReverts() public {
        vm.prank(owner);
        vm.expectRevert("Owner is immutable");
        sweep.transferOwnership(user1);
    }

    function testRenounceOwnershipReverts() public {
        vm.prank(owner);
        vm.expectRevert("Owner is immutable");
        sweep.renounceOwnership();
    }

    // ==================== executeBatchSweep Tests ====================

    function testExecuteBatchSweepETH() public {
        uint256 recipientBalanceBefore = recipient.balance;

        Sweep.SweepBatch[] memory batches = new Sweep.SweepBatch[](1);
        batches[0] = Sweep.SweepBatch({
            token: address(0),
            recipient: recipient,
            amount: 1 ether
        });

        vm.prank(owner);
        sweep.executeBatchSweep(batches);

        assertEq(recipient.balance, recipientBalanceBefore + 1 ether);
        assertEq(address(sweep).balance, 9 ether);
    }

    function testExecuteBatchSweepERC20() public {
        assertTrue(lgcyToken.transfer(address(sweep), 100 ether));

        Sweep.SweepBatch[] memory batches = new Sweep.SweepBatch[](1);
        batches[0] = Sweep.SweepBatch({
            token: address(lgcyToken),
            recipient: recipient,
            amount: 100 ether
        });

        vm.prank(owner);
        sweep.executeBatchSweep(batches);

        assertEq(lgcyToken.balanceOf(recipient), 100 ether);
    }

    function testExecuteBatchSweepMultiple() public {
        assertTrue(lgcyToken.transfer(address(sweep), 100 ether));
        assertTrue(dlgtToken.transfer(address(sweep), 50 ether));

        Sweep.SweepBatch[] memory batches = new Sweep.SweepBatch[](3);
        batches[0] = Sweep.SweepBatch({
            token: address(0),
            recipient: recipient,
            amount: 2 ether
        });
        batches[1] = Sweep.SweepBatch({
            token: address(lgcyToken),
            recipient: recipient,
            amount: 100 ether
        });
        batches[2] = Sweep.SweepBatch({
            token: address(dlgtToken),
            recipient: recipient,
            amount: 50 ether
        });

        vm.prank(owner);
        sweep.executeBatchSweep(batches);

        assertEq(recipient.balance, 2 ether);
        assertEq(lgcyToken.balanceOf(recipient), 100 ether);
        assertEq(dlgtToken.balanceOf(recipient), 50 ether);
    }

    function testExecuteBatchSweepOnlyOwner() public {
        Sweep.SweepBatch[] memory batches = new Sweep.SweepBatch[](0);

        vm.prank(user1);
        vm.expectRevert();
        sweep.executeBatchSweep(batches);
    }

    function testExecuteBatchSweepETHTransferFailed() public {
        address failingRecipient = address(new RevertingReceiver());

        Sweep.SweepBatch[] memory batches = new Sweep.SweepBatch[](1);
        batches[0] = Sweep.SweepBatch({
            token: address(0),
            recipient: failingRecipient,
            amount: 1 ether
        });

        vm.prank(owner);
        vm.expectRevert("Sweep: ETH transfer failed");
        sweep.executeBatchSweep(batches);
    }

    // ==================== executeBatchPermitSweep Tests ====================

    function testExecuteBatchPermitSweep() public {
        address user1Address = vm.addr(user1PrivateKey);
        prmtToken.mint(user1Address, 1000 ether);

        uint256 amount = 100 ether;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            user1Address,
            user1PrivateKey,
            amount,
            deadline
        );

        Sweep.PermitBatch[] memory batches = new Sweep.PermitBatch[](1);
        batches[0] = Sweep.PermitBatch({
            token: address(prmtToken),
            owner: user1Address,
            amount: amount,
            deadline: deadline,
            v: v,
            r: r,
            s: s
        });

        vm.prank(owner);
        sweep.executeBatchPermitSweep(batches, recipient);

        assertEq(prmtToken.balanceOf(recipient), amount);
        assertEq(prmtToken.balanceOf(user1Address), 900 ether);
    }

    function testExecuteBatchPermitSweepMultiple() public {
        address user1Address = vm.addr(user1PrivateKey);
        address user2Address = vm.addr(user2PrivateKey);

        prmtToken.mint(user1Address, 1000 ether);
        prmtToken.mint(user2Address, 1000 ether);

        _testExecuteBatchPermitSweepMultipleHelper(user1Address, user2Address);
    }

    function _testExecuteBatchPermitSweepMultipleHelper(
        address user1Address,
        address user2Address
    ) internal {
        uint256 amount1 = 100 ether;
        uint256 amount2 = 200 ether;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v1, bytes32 r1, bytes32 s1) = _createPermitSignature(
            user1Address,
            user1PrivateKey,
            amount1,
            deadline
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = _createPermitSignature(
            user2Address,
            user2PrivateKey,
            amount2,
            deadline
        );

        Sweep.PermitBatch[] memory batches = new Sweep.PermitBatch[](2);
        batches[0] = Sweep.PermitBatch(
            address(prmtToken),
            user1Address,
            amount1,
            deadline,
            v1,
            r1,
            s1
        );
        batches[1] = Sweep.PermitBatch(
            address(prmtToken),
            user2Address,
            amount2,
            deadline,
            v2,
            r2,
            s2
        );

        vm.prank(owner);
        sweep.executeBatchPermitSweep(batches, recipient);

        assertEq(prmtToken.balanceOf(recipient), amount1 + amount2);
    }

    function testExecuteBatchPermitSweepOnlyOwner() public {
        Sweep.PermitBatch[] memory batches = new Sweep.PermitBatch[](0);

        vm.prank(user1);
        vm.expectRevert();
        sweep.executeBatchPermitSweep(batches, recipient);
    }

    // ==================== executeBatchAuthSweep Tests ====================

    function testExecuteBatchAuthSweep() public {
        address user1Address = vm.addr(user1PrivateKey);
        usdcToken.mint(user1Address, 1000e6);

        uint256 value = 100e6;
        bytes32 nonce = keccak256("test-nonce");

        (uint8 v, bytes32 r, bytes32 s) = _createAuthSignature(
            user1Address,
            recipient,
            value,
            0,
            block.timestamp + 1 hours,
            nonce,
            user1PrivateKey
        );

        Sweep.AuthBatch[] memory batches = new Sweep.AuthBatch[](1);
        batches[0] = Sweep.AuthBatch({
            token: address(usdcToken),
            from: user1Address,
            to: recipient,
            value: value,
            validAfter: 0,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce,
            v: v,
            r: r,
            s: s
        });

        sweep.executeBatchAuthSweep(batches);

        assertEq(usdcToken.balanceOf(recipient), value);
        assertEq(usdcToken.balanceOf(user1Address), 900e6);
    }

    function testExecuteBatchAuthSweepMultiple() public {
        address user1Address = vm.addr(user1PrivateKey);
        address user2Address = vm.addr(user2PrivateKey);

        usdcToken.mint(user1Address, 1000e6);
        usdcToken.mint(user2Address, 1000e6);

        _testExecuteBatchAuthSweepMultipleHelper(user1Address, user2Address);
    }

    function _testExecuteBatchAuthSweepMultipleHelper(
        address user1Address,
        address user2Address
    ) internal {
        uint256 value1 = 100e6;
        uint256 value2 = 200e6;
        uint256 validBefore = block.timestamp + 1 hours;

        (uint8 v1, bytes32 r1, bytes32 s1) = _createAuthSignature(
            user1Address,
            recipient,
            value1,
            0,
            validBefore,
            keccak256("nonce1"),
            user1PrivateKey
        );

        (uint8 v2, bytes32 r2, bytes32 s2) = _createAuthSignature(
            user2Address,
            recipient,
            value2,
            0,
            validBefore,
            keccak256("nonce2"),
            user2PrivateKey
        );

        Sweep.AuthBatch[] memory batches = new Sweep.AuthBatch[](2);
        batches[0] = Sweep.AuthBatch(
            address(usdcToken),
            user1Address,
            recipient,
            value1,
            0,
            validBefore,
            keccak256("nonce1"),
            v1,
            r1,
            s1
        );
        batches[1] = Sweep.AuthBatch(
            address(usdcToken),
            user2Address,
            recipient,
            value2,
            0,
            validBefore,
            keccak256("nonce2"),
            v2,
            r2,
            s2
        );

        sweep.executeBatchAuthSweep(batches);

        assertEq(usdcToken.balanceOf(recipient), value1 + value2);
    }

    function testExecuteBatchAuthSweepAnyoneCanCall() public {
        address user1Address = vm.addr(user1PrivateKey);
        usdcToken.mint(user1Address, 1000e6);

        uint256 value = 100e6;
        bytes32 nonce = keccak256("test-nonce-2");

        (uint8 v, bytes32 r, bytes32 s) = _createAuthSignature(
            user1Address,
            recipient,
            value,
            0,
            block.timestamp + 1 hours,
            nonce,
            user1PrivateKey
        );

        Sweep.AuthBatch[] memory batches = new Sweep.AuthBatch[](1);
        batches[0] = Sweep.AuthBatch({
            token: address(usdcToken),
            from: user1Address,
            to: recipient,
            value: value,
            validAfter: 0,
            validBefore: block.timestamp + 1 hours,
            nonce: nonce,
            v: v,
            r: r,
            s: s
        });

        vm.prank(user2);
        sweep.executeBatchAuthSweep(batches);

        assertEq(usdcToken.balanceOf(recipient), value);
    }

    // ==================== sweepAllETH Tests ====================

    function testSweepAllETH() public {
        vm.deal(address(sweep), 1 ether);
        uint256 initialBalance = user2.balance;

        vm.prank(owner);
        sweep.sweepAllEth(user2);

        assertEq(user2.balance, initialBalance + 1 ether);
        assertEq(address(sweep).balance, 0);
    }

    function testSweepAllETHOnlyOwner() public {
        vm.deal(address(sweep), 1 ether);

        vm.prank(user1);
        vm.expectRevert();
        sweep.sweepAllEth(user2);
    }

    function testSweepAllETHRevertsOnZeroBalance() public {
        // Drain first
        vm.prank(owner);
        sweep.sweepAllEth(user2);

        vm.prank(owner);
        vm.expectRevert("Sweep: no ETH balance");
        sweep.sweepAllEth(user2);
    }

    function testSweepAllETHTransferFailed() public {
        vm.deal(address(sweep), 1 ether);

        // Use a contract that reverts on receive
        RevertingReceiver revRecipient = new RevertingReceiver();

        vm.prank(owner);
        vm.expectRevert("Sweep: ETH transfer failed");
        sweep.sweepAllEth(address(revRecipient));
    }

    // ==================== sweepAllTokens Tests ====================

    function testSweepAllTokens() public {
        assertTrue(lgcyToken.transfer(address(sweep), 100 ether));
        uint256 initialBalance = lgcyToken.balanceOf(recipient);

        vm.prank(owner);
        sweep.sweepAllTokens(address(lgcyToken), recipient);

        assertEq(lgcyToken.balanceOf(address(sweep)), 0);
        assertEq(lgcyToken.balanceOf(recipient), initialBalance + 100 ether);
    }

    function testSweepAllTokensRevertsOnZeroBalance() public {
        vm.prank(owner);
        vm.expectRevert("Sweep: no token balance");
        sweep.sweepAllTokens(address(lgcyToken), recipient);
    }

    function testSweepAllTokensOnlyOwner() public {
        assertTrue(lgcyToken.transfer(address(sweep), 100 ether));

        vm.prank(user1);
        vm.expectRevert();
        sweep.sweepAllTokens(address(lgcyToken), recipient);
    }

    // ==================== receive Tests ====================

    function testReceiveETH() public {
        uint256 balanceBefore = address(sweep).balance;

        (bool success, ) = address(sweep).call{value: 5 ether}("");
        assertTrue(success);
        assertEq(address(sweep).balance, balanceBefore + 5 ether);
    }

    function testReceiveETHFromUser() public {
        vm.deal(user1, 20 ether);
        uint256 balanceBefore = address(sweep).balance;

        vm.prank(user1);
        (bool success, ) = address(sweep).call{value: 3 ether}("");
        assertTrue(success);
        assertEq(address(sweep).balance, balanceBefore + 3 ether);
    }
}

contract RevertingReceiver {
    receive() external payable {
        revert("I reject your ETH");
    }
}
