// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MocksScript} from "../script/Mocks.s.sol";
import {MockLGCY, MockDLGT, MockPRMT, MockUSDC} from "../src/Mocks.sol";

contract MocksScriptTest is Test {
    MocksScript mocksScript;

    function setUp() public {
        mocksScript = new MocksScript();
    }

    function test_MocksScript() public {
        mocksScript.run();
        // Script runs successfully and logs addresses
    }
}

contract MocksTest is Test {
    MockLGCY public lgcyToken;
    MockDLGT public dlgtToken;
    MockPRMT public prmtToken;
    MockUSDC public usdcToken;

    address public deployer = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    uint256 public user1PrivateKey = 0xA11CE;

    function setUp() public {
        lgcyToken = new MockLGCY();
        dlgtToken = new MockDLGT();
        prmtToken = new MockPRMT();
        usdcToken = new MockUSDC();
    }

    // ==================== MockLGCY Tests ====================

    function testMockLGCYDeployment() public view {
        assertEq(lgcyToken.name(), "Legacy Token");
        assertEq(lgcyToken.symbol(), "LGCY");
        assertEq(lgcyToken.decimals(), 18);
        assertEq(lgcyToken.totalSupply(), 1000000 * 10 ** 18);
        assertEq(lgcyToken.balanceOf(deployer), 1000000 * 10 ** 18);
    }

    function testMockLGCYMint() public {
        uint256 amount = 500 ether;
        lgcyToken.mint(user1, amount);

        assertEq(lgcyToken.balanceOf(user1), amount);
        assertEq(lgcyToken.totalSupply(), 1000000 * 10 ** 18 + amount);
    }

    function testMockLGCYMintMultiple() public {
        lgcyToken.mint(user1, 100 ether);
        lgcyToken.mint(user2, 200 ether);
        lgcyToken.mint(user1, 50 ether);

        assertEq(lgcyToken.balanceOf(user1), 150 ether);
        assertEq(lgcyToken.balanceOf(user2), 200 ether);
    }

    function testMockLGCYTransfer() public {
        assertTrue(lgcyToken.transfer(user1, 1000 ether));
        assertEq(lgcyToken.balanceOf(user1), 1000 ether);
    }

    // ==================== MockDLGT Tests ====================

    function testMockDLGTDeployment() public view {
        assertEq(dlgtToken.name(), "Delegate Token");
        assertEq(dlgtToken.symbol(), "DLGT");
        assertEq(dlgtToken.decimals(), 18);
        assertEq(dlgtToken.totalSupply(), 1000000 * 10 ** 18);
        assertEq(dlgtToken.balanceOf(deployer), 1000000 * 10 ** 18);
    }

    function testMockDLGTMint() public {
        uint256 amount = 750 ether;
        dlgtToken.mint(user1, amount);

        assertEq(dlgtToken.balanceOf(user1), amount);
        assertEq(dlgtToken.totalSupply(), 1000000 * 10 ** 18 + amount);
    }

    function testMockDLGTMintMultiple() public {
        dlgtToken.mint(user1, 300 ether);
        dlgtToken.mint(user2, 400 ether);

        assertEq(dlgtToken.balanceOf(user1), 300 ether);
        assertEq(dlgtToken.balanceOf(user2), 400 ether);
    }

    function testMockDLGTTransfer() public {
        assertTrue(dlgtToken.transfer(user2, 2000 ether));
        assertEq(dlgtToken.balanceOf(user2), 2000 ether);
    }

    // ==================== MockPRMT Tests ====================

    function testMockPRMTDeployment() public view {
        assertEq(prmtToken.name(), "Permit Token");
        assertEq(prmtToken.symbol(), "PRMT");
        assertEq(prmtToken.decimals(), 18);
        assertEq(prmtToken.totalSupply(), 1000000 * 10 ** 18);
        assertEq(prmtToken.balanceOf(deployer), 1000000 * 10 ** 18);
    }

    function testMockPRMTMint() public {
        uint256 amount = 1500 ether;
        prmtToken.mint(user1, amount);

        assertEq(prmtToken.balanceOf(user1), amount);
        assertEq(prmtToken.totalSupply(), 1000000 * 10 ** 18 + amount);
    }

    function testMockPRMTPermit() public {
        address owner = vm.addr(user1PrivateKey);
        prmtToken.mint(owner, 1000 ether);

        uint256 amount = 500 ether;
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                user2,
                amount,
                prmtToken.nonces(owner),
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        prmtToken.permit(owner, user2, amount, deadline, v, r, s);

        assertEq(prmtToken.allowance(owner, user2), amount);
        assertEq(prmtToken.nonces(owner), 1);
    }

    function testMockPRMTDomainSeparator() public view {
        bytes32 domainSeparator = prmtToken.DOMAIN_SEPARATOR();
        assertTrue(domainSeparator != bytes32(0));
    }

    function testMockPRMTNonces() public view {
        address owner = vm.addr(user1PrivateKey);
        assertEq(prmtToken.nonces(owner), 0);
    }

    // ==================== MockUSDC Tests ====================

    function testMockUSDCDeployment() public view {
        assertEq(usdcToken.name(), "USD Coin");
        assertEq(usdcToken.symbol(), "USDC");
        assertEq(usdcToken.decimals(), 6);
        assertEq(usdcToken.totalSupply(), 1000000 * 10 ** 6);
        assertEq(usdcToken.balanceOf(deployer), 1000000 * 10 ** 6);
    }

    function testMockUSDCDecimals() public view {
        assertEq(usdcToken.decimals(), 6);
    }

    function testMockUSDCMint() public {
        uint256 amount = 5000e6;
        usdcToken.mint(user1, amount);

        assertEq(usdcToken.balanceOf(user1), amount);
        assertEq(usdcToken.totalSupply(), 1000000 * 10 ** 6 + amount);
    }

    function testMockUSDCDomainSeparator() public view {
        bytes32 domainSeparator = usdcToken.DOMAIN_SEPARATOR();
        assertTrue(domainSeparator != bytes32(0));
    }

    function testMockUSDCTransferWithAuthorization() public {
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 10000e6);

        uint256 value = 1000e6;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("test-nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        assertEq(usdcToken.balanceOf(user2), value);
        assertEq(usdcToken.balanceOf(from), 9000e6);
        assertTrue(usdcToken._authorizationStates(nonce));
    }

    function testMockUSDCTransferWithAuthorizationRevertsNotYetValid() public {
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 10000e6);

        uint256 value = 1000e6;
        uint256 validAfter = block.timestamp + 1 hours;
        uint256 validBefore = block.timestamp + 2 hours;
        bytes32 nonce = keccak256("future-nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        vm.expectRevert("Auth: not yet valid");
        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    function testMockUSDCTransferWithAuthorizationRevertsExpired() public {
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 10000e6);

        uint256 value = 1000e6;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp - 1;
        bytes32 nonce = keccak256("expired-nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        vm.expectRevert("Auth: expired");
        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    function testMockUSDCTransferWithAuthorizationRevertsUsedNonce() public {
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 10000e6);

        uint256 value = 1000e6;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("reused-nonce");

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        // First call succeeds
        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        // Second call with same nonce reverts
        vm.expectRevert("Auth: used");
        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    function testMockUSDCTransferWithAuthorizationRevertsInvalidSignature()
        public
    {
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 10000e6);

        uint256 value = 1000e6;
        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("invalid-sig-nonce");

        // Create signature with wrong private key
        uint256 wrongPrivateKey = 0xDEADBEEF;

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);

        vm.expectRevert("Auth: invalid signature");
        usdcToken.transferWithAuthorization(
            from,
            user2,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    function testMockUSDCAuthorizationStatesPublic() public view {
        bytes32 nonce = keccak256("check-state");
        assertFalse(usdcToken._authorizationStates(nonce));
    }

    function testMockUSDCAuthorizationStateFunction() public {
        bytes32 nonce = keccak256("check-state-func");
        assertFalse(usdcToken.authorizationState(address(0), nonce));

        // Perform transfer to set nonce used
        address from = vm.addr(user1PrivateKey);
        usdcToken.mint(from, 1000e6);

        bytes32 structHash = keccak256(
            abi.encode(
                usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                user2,
                100e6,
                0,
                block.timestamp + 1 hours,
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(user1PrivateKey, digest);

        usdcToken.transferWithAuthorization(
            from,
            user2,
            100e6,
            0,
            block.timestamp + 1 hours,
            nonce,
            v,
            r,
            s
        );

        assertTrue(usdcToken.authorizationState(from, nonce));
    }

    function testMockUSDCTransferWithAuthorizationTypehash() public view {
        bytes32 expected = keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );
        assertEq(usdcToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), expected);
    }
}
