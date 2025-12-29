// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MockLGCY is ERC20 {
    constructor() ERC20("Legacy Token", "LGCY") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockDLGT is ERC20 {
    constructor() ERC20("Delegate Token", "DLGT") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockPRMT is ERC20Permit {
    constructor() ERC20("Permit Token", "PRMT") ERC20Permit("Permit Token") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract MockUSDC is ERC20, EIP712 {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    mapping(bytes32 => bool) public _authorizationStates;

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {
        _mint(msg.sender, 1000000 * 10 ** 6);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function authorizationState(
        address,
        bytes32 nonce
    ) external view returns (bool) {
        return _authorizationStates[nonce];
    }

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp >= validAfter, "Auth: not yet valid");
        require(block.timestamp <= validBefore, "Auth: expired");
        require(!_authorizationStates[nonce], "Auth: used");

        bytes32 structHash;
        bytes32 typeHash = TRANSFER_WITH_AUTHORIZATION_TYPEHASH;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, typeHash)
            mstore(add(ptr, 0x20), from)
            mstore(add(ptr, 0x40), to)
            mstore(add(ptr, 0x60), value)
            mstore(add(ptr, 0x80), validAfter)
            mstore(add(ptr, 0xa0), validBefore)
            mstore(add(ptr, 0xc0), nonce)
            structHash := keccak256(ptr, 0xe0)
        }

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == from, "Auth: invalid signature");

        _authorizationStates[nonce] = true;
        _transfer(from, to, value);
    }
}
