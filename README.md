# 🔥 HotSweep

**Enterprise-Grade Cryptocurrency Sweep System**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Viem](https://img.shields.io/badge/Viem-2.0-purple)](https://viem.sh/)
[![Coverage](https://img.shields.io/badge/Coverage-91%25-green)](https://github.com/hotsweep/hotsweep)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

_HD Wallets (BIP32/44) • Multi-Strategy Gas Optimization • Multi-Chain Support_

[Getting Started](#-quick-start) •
[Documentation](#-command-reference) •
[Architecture](#-architecture) •
[Examples](#-examples)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Command Reference](#-command-reference)
- [Configuration](#-configuration)
- [Sweep Strategies](#-sweep-strategies)
- [Examples](#-examples)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [API Reference](#-api-reference)

---

## 🎯 Overview

HotSweep is an enterprise-grade cryptocurrency sweep system designed for exchanges, payment processors, and dApps that need to manage thousands of deposit addresses efficiently.

### Key Features

| Feature              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| **HD Wallets**       | BIP32/44 deterministic address generation from single seed |
| **Multi-Strategy**   | EIP-7702, EIP-2612, EIP-3009, and Legacy sweep methods     |
| **Gas Optimization** | Up to 90% gas savings with modern EIP strategies           |
| **Multi-Chain**      | Ethereum, Polygon, Arbitrum, and more EVM chains           |
| **Type-Safe**        | Full TypeScript support with strict typing                 |
| **Reliability**      | >90% test coverage across all core packages                |
| **Stateless**        | Pure functions with no side effects                        |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HOTSWEEP SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────┐      ┌───────────────┐      ┌──────────────────────┐   │
│   │           │      │               │      │                      │   │
│   │  HD Seed  │─────▶│  Address Pool │─────▶│    Sweep Engine      │   │
│   │  (xpriv)  │      │               │      │                      │   │
│   │           │      │  ┌─────────┐  │      │  ┌────────────────┐  │   │
│   └───────────┘      │  │ 0x...001│  │      │  │   EIP-7702     │──┼──▶│ 90% ↓
│         │            │  │ 0x...002│  │      │  │   (Delegate)   │  │   │
│         │            │  │ 0x...003│  │      │  ├────────────────┤  │   │
│         ▼            │  │   ...   │  │      │  │   EIP-2612     │──┼──▶│ 60% ↓
│   ┌───────────┐      │  │ 0x...00n│  │      │  │   (Permit)     │  │   │
│   │   xpub    │      │  └─────────┘  │      │  ├────────────────┤  │   │
│   │  (public) │      │               │      │  │   EIP-3009     │──┼──▶│ 60% ↓
│   └───────────┘      └───────────────┘      │  │   (Auth)       │  │   │
│         │                    ▲              │  ├────────────────┤  │   │
│         │                    │              │  │   LEGACY       │──┼──▶│  0% ↓
│         ▼                    │              │  │   (Standard)   │  │   │
│   ┌───────────┐              │              │  └────────────────┘  │   │
│   │  Address  │──────────────┘              │                      │   │
│   │ Generator │                             └──────────────────────┘   │
│   └───────────┘                                      │                 │
│                                                      ▼                 │
│                                           ┌──────────────────┐         │
│                                           │  Hot Wallet      │         │
│                                           │  (Consolidated)  │         │
│                                           └──────────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @hotsweep/cli

# Or use npx
npx @hotsweep/cli init
```

### Initialize Project

```bash
# Initialize with test environment (Anvil)
sweep init --test

# Initialize for production
sweep init --deploy 1,137
```

### Generate Addresses

```bash
# Generate 100 deposit addresses
sweep address --count 100 --output deposits.csv
```

### Sweep Funds

```bash
# Sweep all USDC from first 100 addresses to hot wallet
sweep transfer \
  --from "0-99" \
  --to hot-wallet \
  --chain polygon \
  --token USDC \
  --amount all
```

---

## 🏗️ Architecture

### Package Structure

```
hotsweep/
├── apps/
│   └── cli/                 # @hotsweep/cli - Command-line interface
│       ├── src/
│       │   ├── bin/         # CLI entry point
│       │   └── commands/    # Command implementations
│       └── package.json
│
├── packages/
│   ├── core/                # @hotsweep/core - Main SDK
│   │   ├── src/
│   │   │   ├── wallet/      # HD wallet & key derivation
│   │   │   ├── address/     # Address generation & parsing
│   │   │   ├── config/      # Configuration management
│   │   │   ├── chain/       # Multi-chain client factory
│   │   │   ├── balance/     # Balance queries
│   │   │   └── transfer/    # Sweep execution engine
│   │   └── package.json
│   │
│   ├── types/               # @hotsweep/types - Shared types
│   │   └── src/
│   │       ├── common.types.ts
│   │       ├── config.types.ts
│   │       ├── balance.types.ts
│   │       └── transfer.types.ts
│   │
│   └── auth/                # @hotsweep/auth - SIWE authentication
│       └── src/
│           └── siwe.ts
│
└── contracts/               # Smart contracts (HotSweep.sol)
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW DIAGRAM                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Request                                                            │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐    ┌─────────────────┐   │
│  │   CLI   │───▶│  Config  │───▶│   Parser   │───▶│  Address Pool   │   │
│  └─────────┘    └──────────┘    └────────────┘    └─────────────────┘   │
│                      │                                     │             │
│                      ▼                                     ▼             │
│               ┌──────────┐                        ┌─────────────────┐   │
│               │  Schema  │                        │  HD Derivation  │   │
│               │  (Zod)   │                        │  (BIP32/44)     │   │
│               └──────────┘                        └─────────────────┘   │
│                                                            │             │
│                                                            ▼             │
│  ┌──────────┐    ┌───────────┐    ┌────────────┐    ┌────────────┐     │
│  │ Receipt  │◀───│ Executor  │◀───│  Strategy  │◀───│  Balances  │     │
│  └──────────┘    └───────────┘    │  Selector  │    └────────────┘     │
│                        │          └────────────┘          ▲             │
│                        ▼                │                 │             │
│                 ┌───────────┐           │          ┌────────────┐       │
│                 │  Viem     │◀──────────┘          │ Multicall3 │       │
│                 │  Client   │─────────────────────▶│ (Batched)  │       │
│                 └───────────┘                      └────────────┘       │
│                        │                                                 │
│                        ▼                                                 │
│                 ┌───────────┐                                           │
│                 │ Blockchain│                                           │
│                 │  Network  │                                           │
│                 └───────────┘                                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📖 Command Reference

### Quick Reference

| Command          | Description            | Example                                          |
| ---------------- | ---------------------- | ------------------------------------------------ |
| `sweep init`     | Initialize environment | `sweep init --test`                              |
| `sweep address`  | Generate HD addresses  | `sweep address --count 100`                      |
| `sweep balance`  | Query balances         | `sweep balance --target 0-99`                    |
| `sweep transfer` | Execute sweeps         | `sweep transfer --from 42 --to hot --amount all` |
| `sweep config`   | Manage configuration   | `sweep config get settings.batchSize`            |

### `sweep init`

Initialize the HotSweep environment, deploy contracts, and validate configuration.

```bash
sweep init [options]

Options:
  --deploy <chains>   Deploy contracts (e.g., "1,137,42161")
  --test              Initialize test environment (Anvil)
  --config <path>     Config file path (default: "./hotsweep.json")
  --force             Overwrite existing deployments
```

**Examples:**

```bash
# Deploy to Ethereum and Polygon
sweep init --deploy 1,137

# Initialize local test environment
sweep init --test

# Validate existing configuration
sweep init
```

### `sweep address`

Generate deterministic HD wallet addresses for user deposits.

```bash
sweep address [options]

Options:
  -i, --index <n>      Single address index
  -s, --start <n>      Start index for batch (default: 0)
  -c, --count <n>      Number of addresses to generate
  -e, --end <n>        End index (inclusive)
  -t, --coin-type <n>  BIP44 coin type (default: 60 for ETH)
  -f, --format <type>  Output format: json, csv, text
  -o, --output <path>  Save to file
```

**Examples:**

```bash
# Generate single address
sweep address --index 42

# Generate range of addresses
sweep address --start 0 --count 1000

# Export to CSV
sweep address --count 1000 --format csv --output deposits.csv
```

**Output Formats:**

<table>
<tr><th>Format</th><th>Example Output</th></tr>
<tr>
<td>JSON</td>
<td>

```json
{
  "index": 42,
  "path": "m/44'/60'/0'/0/42",
  "address": "0x742d35Cc..."
}
```

</td>
</tr>
<tr>
<td>CSV</td>
<td>

```csv
index,path,address
42,m/44'/60'/0'/0/42,0x742d35Cc...
```

</td>
</tr>
<tr>
<td>Text</td>
<td>

```
Index: 42
Path:  m/44'/60'/0'/0/42
Addr:  0x742d35Cc...
```

</td>
</tr>
</table>

### `sweep balance`

Query balances across multiple chains, addresses, and tokens.

```bash
sweep balance [options]

Options:
  --target <val>       Index, range, address, or label
  --chain <id/name>    Filter by chain (default: all enabled)
  --token <symbol>     Filter by token (default: all enabled)
  --min <amount>       Hide balances below threshold
  --format <type>      Output: table, json, csv (default: table)
  --output <path>      Save results to file
```

**Examples:**

```bash
# Single address balance
sweep balance --target 42

# Range with minimum filter
sweep balance --target 0-999 --token USDC --min 10

# Export for accounting
sweep balance --target 0-9999 --format csv --output balances.csv
```

### `sweep transfer`

Execute batch payments and sweeps with gas-optimized strategies.

```bash
sweep transfer [options]

Options:
  --batch <path>       JSON/CSV file with transfers
  --from <val>         Source: index, range, or label
  --to <val>           Destination: address, index, or label
  --chain <id/name>    Chain ID or name
  --token <symbol>     Token symbol or contract address
  --amount <val>       Amount or "all" for max sweep
  --strategy <type>    auto, eip7702, eip2612, eip3009, legacy
  --dry-run            Simulate without broadcasting
  --parallel <n>       Concurrent transfers (default: 1)
  --ref <text>         Transaction reference ID
```

**Address Specification Types:**

| Type      | Format | Example           | Description              |
| --------- | ------ | ----------------- | ------------------------ |
| `index`   | Number | `42`              | Single HD index          |
| `indices` | Array  | `1,5,10`          | Explicit list            |
| `range`   | String | `0-10,99,500-505` | Smart range parser       |
| `address` | Hex    | `0x742d35...`     | Raw Ethereum address     |
| `label`   | String | `hot-wallet`      | Wallet alias from config |

**Examples:**

```bash
# Single sweep
sweep transfer \
  --from 42 \
  --to hot-wallet \
  --chain polygon \
  --token USDC \
  --amount all

# Batch sweep with parallel execution
sweep transfer \
  --from "0-99" \
  --to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  --chain ethereum \
  --token ETH \
  --amount all \
  --parallel 10

# Dry run simulation
sweep transfer \
  --from 42 \
  --to hot-wallet \
  --chain polygon \
  --token USDC \
  --amount all \
  --dry-run
```

### `sweep config`

Manage HotSweep configuration using dot notation.

```bash
sweep config                    # Display full config
sweep config get <key>          # Get specific value
sweep config set <key> <val>    # Update value
sweep config del <key>          # Delete key
sweep config validate           # Validate schema
sweep config path               # Show config file location
```

**Dot Notation Examples:**

```bash
# Get values
sweep config get settings.batchSize
sweep config get chains.eip155:1.name
sweep config get wallets.hot-wallet.address

# Set values
sweep config set settings.batchSize 50
sweep config set settings.parallelChains true
sweep config set chains.eip155:1.enabled false

# Delete keys
sweep config del chains.eip155:137
```

---

## ⚙️ Configuration

### Configuration File Structure

```json
{
  "version": "2.0.0",
  "chains": {
    "eip155:1": {
      "namespace": "eip155",
      "chainId": 1,
      "name": "ethereum",
      "aliases": ["eth", "mainnet"],
      "coinType": 60,
      "enabled": true,
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "rpcUrls": {
        "default": {
          "http": ["https://eth.merkle.io"]
        }
      },
      "contracts": {
        "multicall3": {
          "address": "0xca11bde05977b3631167028862be2a173976ca11"
        },
        "hotsweep": {
          "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
        }
      }
    }
  },
  "wallets": {
    "hot-wallet": {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "chains": ["eip155:1", "eip155:137"],
      "enabled": true,
      "keySource": {
        "type": "env",
        "variable": "SWEEP_HOT_WALLET_PRIVATE_KEY"
      }
    }
  },
  "tokens": {
    "eip155:1": {
      "ETH": {
        "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "enabled": true
      },
      "USDC": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "enabled": true,
        "decimals": 6,
        "strategy": "eip3009"
      }
    }
  },
  "settings": {
    "batchSize": 20,
    "parallelChains": true,
    "retryAttempts": 3,
    "retryDelay": 5000
  }
}
```

test:

```json
{
  "version": "2.0.0",
  "chains": {
    "eip155:31337": {
      "namespace": "eip155",
      "chainId": 31337,
      "name": "ethereum",
      "aliases": ["eth", "mainnet"],
      "coinType": 60,
      "enabled": true,
      "nativeCurrency": {
        "decimals": 18,
        "name": "Ether",
        "symbol": "ETH"
      },
      "rpcUrls": {
        "default": {
          "http": ["http://127.0.0.1:8545"],
          "webSocket": ["ws://127.0.0.1:8545"]
        }
      },
      "contracts": {
        "hotsweep": {
          "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          "blockCreated": 0
        }
      }
    }
  },
  "wallets": {
    "hot-wallet": {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "chains": ["eip155:31337"],
      "enabled": true,
      "keySource": {
        "type": "env",
        "variable": "SWEEP_HOT_WALLET_PRIVATE_KEY"
      }
    }
  },
  "tokens": {
    "eip155:31337": {
      "ETH": {
        "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "enabled": true
      },
      "LGCY": {
        "address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c6475",
        "enabled": true
      },
      "DLGT": {
        "address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c6476",
        "enabled": true
      },
      "PRMT": {
        "address": "0x3c499c542cef5e3811e1192ce70d8cc03d5c6477",
        "enabled": true
      },
      "USDC": {
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "enabled": true,
        "decimals": 6,
        "strategy": "eip3009"
      }
    }
  },
  "settings": {
    "batchSize": 20,
    "parallelChains": true,
    "retryAttempts": 3,
    "retryDelay": 5000
  }
}
```

### Environment Variables

```bash
# .env.private (NEVER commit to version control!)

# HD Wallet
SWEEP_MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
SWEEP_XPRIV="xprv9s21ZrQH143K..."
SWEEP_XPUB="xpub6D4BDPcP2GT..."

# Wallet Private Keys
SWEEP_HOT_WALLET_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
SWEEP_DEPLOYER_PRIVATE_KEY="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
```

### Chain ID Formats

HotSweep supports multiple chain identifier formats:

| Format   | Example          | Description                |
| -------- | ---------------- | -------------------------- |
| CAIP-2   | `eip155:1`       | Canonical chain identifier |
| Chain ID | `1` or `"1"`     | Numeric chain ID           |
| Name     | `ethereum`       | Chain name from config     |
| Alias    | `eth`, `mainnet` | Chain aliases from config  |

```bash
# All equivalent
sweep balance --target 42 --chain eip155:1
sweep balance --target 42 --chain 1
sweep balance --target 42 --chain ethereum
sweep balance --target 42 --chain eth
```

---

## ⚡ Sweep Strategies

### Performance Benchmark

Based on real-world scenarios with users having ONLY tokens (no ETH), HotSweep automatically determines the most gas-efficient strategy. Our benchmarks on local test environments (Anvil) show significant savings:

| Users | LEGACY (baseline) | EIP-2612        | EIP-3009           | EIP-7702        | Winner   |
| ----- | ----------------- | --------------- | ------------------ | --------------- | -------- |
| 1     | 68,389            | 92,599+35% ❌   | 84,302+23% ❌      | 66,110-3.3% ✅  | EIP-7702 |
| 5     | 256,433           | 298,925+16% ❌  | 218,990-14.6% ✅   | 262,150+2% ❌   | EIP-3009 |
| 10    | 512,866           | 573,916+11% ❌  | 408,746-20.3% ✅   | 524,300+2% ❌   | EIP-3009 |
| 25    | 1,282,165         | 1,398,900+9% ❌ | 977,762-23.7% ✅   | 1,310,750+2% ❌ | EIP-3009 |
| 50    | 2,564,282         | 2,773,836+8% ❌ | 1,926,602-24.9% ✅ | 2,621,500+2% ❌ | EIP-3009 |
| 100   | 5,128,624         | 5,523,835+7% ❌ | 3,823,718-25.4% ✅ | 5,243,000+2% ❌ | EIP-3009 |

### Strategy Recommendations

| Scenario                | Recommended Strategy | Reason                               |
| ----------------------- | -------------------- | ------------------------------------ |
| 1-2 users               | EIP-7702 or LEGACY   | Minimal overhead for single calls    |
| 5+ users with USDC/EURC | EIP-3009 ✨          | **Scaling King**: 15-25% gas savings |
| High Gas Environments   | EIP-3009 or EIP-7702 | Eliminates source funding overhead   |
| Standard ERC20 fallback | LEGACY               | Simplest, works for all tokens       |

> **Note**: EIP-2612 (Permit) becomes efficient only at extremely large batch sizes or when combined with custom relayer logic. HotSweep defaults to Legacy for Permit tokens in small batches to ensure lowest total gas consumption.

### Strategy Selection Flow

```
                              ┌─────────────────┐
                              │  Token Address  │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │ Config Override?│
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │ Yes              │                  │ No
                    ▼                  │                  ▼
             ┌─────────────┐           │         ┌───────────────┐
             │   Use       │           │         │ Detect Token  │
             │   Config    │           │         │    Type       │
             └─────────────┘           │         └───────┬───────┘
                                       │                 │
                                       │    ┌────────────┼────────────┐
                                       │    │            │            │
                                       │    ▼            ▼            ▼
                                       │ ┌─────────┐ ┌──────────┐ ┌──────────┐
                                       │ │ EIP-3009│ │EIP-2612? │ │ EIP-7702 │
                                       │ │  Token? │ │(Permit)  │ │Available?│
                                       │ │ (USDC)  │ └────┬─────┘ └────┬─────┘
                                       │ └────┬────┘      │            │
                                       │      │           │       ┌────┴────┐
                                       │      │      ┌────┼────┐  │         │
                                       │      │      │    │    │  │ Yes     │ No
                                       │      ▼      ▼    ▼    ▼  ▼         ▼
                                       │   ┌──────┐┌────┐┌────┐┌────┐  ┌────────┐
                                       │   │EIP-  ││50+ ││<50 ││    │  │ LEGACY │
                                       │   │3009  ││usr ││usr ││7702│  └────────┘
                                       │   │✅23% │└────┘└────┘│✅6%│
                                       │   └──────┘  │     │   └────┘
                                       │             ▼     ▼
                                       │          ┌──────┐┌────────┐
                                       │          │EIP-  ││ LEGACY │
                                       │          │2612  ││        │
                                       │          │⚠️1.5%││        │
                                       │          └──────┘└────────┘
                                       │
                                       └─────────────────┘

Legend:
✅ Best performance (>6% savings)
⚠️ Marginal benefit (1-2% savings, only at 50+ users)
```

```
┌─────────────────────────────────────────────────────────────────┐
│                    STRATEGY SELECTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Check Config Override                                       │
│     └─ If forced strategy → Use config                         │
│                                                                 │
│  2. Detect Token Type                                           │
│     ├─ USDC/EURC/PYUSD → EIP-3009 ✅ (23% savings)             │
│     ├─ ERC20Permit → Check batch size (step 3)                 │
│     └─ Basic ERC20 → Check EIP-7702 (step 4)                   │
│                                                                 │
│  3. EIP-2612 (Permit) Decision                                  │
│     ├─ 50+ users → EIP-2612 ⚠️ (1-2% savings)                  │
│     └─ <50 users → LEGACY (better than EIP-2612)               │
│                                                                 │
│  4. EIP-7702 Decision                                           │
│     ├─ Available → EIP-7702 ✅ (6.5% savings)                  │
│     └─ Not available → LEGACY                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

```

| Strategy | Batch Size 1 | Batch Size 10 | Batch Size 50 | Batch Size 100 | Recommendation     |
| -------- | ------------ | ------------- | ------------- | -------------- | ------------------ |
| LEGACY   | baseline     | baseline      | baseline      | baseline       | Fallback option    |
| EIP-2612 | +31% ❌      | +2.3% ❌      | -1.1% ⚠️      | -1.5% ⚠️       | Only if 50+ users  |
| EIP-3009 | +21.7% ❌    | -18.6% ✅     | -22.7% ✅     | -23.3% ✅      | Best for 10+ users |
| EIP-7702 | -9.7% ✅     | -6.5% ✅      | -6.5% ✅      | -6.5% ✅       | Best for any size  |

### Strategy Details

#### EIP-7702 (Code Delegation)

The most efficient strategy, allowing EOAs to temporarily delegate to a smart contract.

```typescript
// Batch sweep multiple tokens in single transaction
const tx = await hotsweep.executeBatchSweep([
  { token: USDC, recipient: hotWallet, amount: 1000n },
  { token: DAI, recipient: hotWallet, amount: 500n },
  { token: USDT, recipient: hotWallet, amount: 750n },
]);
```

#### EIP-3009 (TransferWithAuthorization)

Gasless transfers for USDC and compatible tokens.

```typescript
// Sign authorization off-chain
const auth = await signTransferWithAuthorization(account, {
  tokenAddress: USDC_ADDRESS,
  to: hotWallet,
  value: amount,
});

// Submit by any party
await token.transferWithAuthorization(
  auth.from,
  auth.to,
  auth.value,
  auth.validAfter,
  auth.validBefore,
  auth.nonce,
  auth.v,
  auth.r,
  auth.s
);
```

#### EIP-2612 (Permit)

Gasless approvals for modern ERC-20 tokens.

```typescript
// Sign permit off-chain
const permit = await signPermit(account, {
  tokenAddress: DAI_ADDRESS,
  spender: hotWallet,
  value: amount,
});

// Execute permit + transfer
await token.permit(permit.owner, permit.spender, permit.value, ...);
await token.transferFrom(permit.owner, hotWallet, amount);
```

#### Legacy (Standard Transfer)

Fallback for tokens without gasless support.

```typescript
// 1. Fund source address with gas
await fundGas(sourceAddress, estimatedGasCost);

// 2. Execute standard transfer
await token.transfer(hotWallet, amount);
```

---

## 💡 Examples

### Daily Sweep Automation

```bash
#!/bin/bash
# daily-sweep.sh

# 1. Find addresses with USDC > $10
sweep balance \
  --target 0-9999 \
  --token USDC \
  --min 10 \
  --format csv \
  --output /tmp/candidates.csv

# 2. Execute sweep
sweep transfer \
  --batch /tmp/candidates.csv \
  --to hot-wallet \
  --chain polygon \
  --parallel 10

# 3. Archive results
mv /tmp/candidates.csv /archive/sweep-$(date +%Y%m%d).csv
```

### Multi-Chain Gas Funding

```bash
# Fund 100 addresses with 0.01 ETH each
sweep transfer \
  --from hot-wallet \
  --to "0-99" \
  --chain ethereum \
  --token ETH \
  --amount 0.01 \
  --parallel 20
```

### Programmatic Usage

```typescript
import {
  generateAddresses,
  queryBalances,
  executeTransfer,
  loadConfig,
} from "@hotsweep/core";

// Load configuration
const config = loadConfig("./hotsweep.json");

// Generate addresses
const { addresses } = generateAddresses(
  { xpub: process.env.SWEEP_XPUB },
  { count: 100 }
);

// Query balances
const balances = await queryBalances(config, {
  addresses: addresses.map((a) => a.address),
  chain: "polygon",
  tokens: ["USDC", "USDT"],
});

// Execute sweep
for (const balance of balances.filter((b) => b.balance > 0n)) {
  await executeTransfer(
    { config },
    {
      from: balance.address,
      to: "hot-wallet",
      chain: "polygon",
      token: balance.token,
      amount: "all",
    }
  );
}
```

### Batch File Format

**JSON:**

```json
[
  {
    "chainId": 137,
    "from": { "type": "range", "value": "0-99" },
    "to": { "type": "label", "value": "hot-wallet" },
    "token": "USDC",
    "amount": "all",
    "reference": "daily-sweep-001"
  },
  {
    "chainId": 1,
    "from": { "type": "label", "value": "hot-wallet" },
    "to": { "type": "range", "value": "100-199" },
    "token": "ETH",
    "amount": "0.01",
    "reference": "gas-funding"
  }
]
```

**CSV:**

```csv
chain,token,amount,from,to,reference
polygon,USDC,all,0-99,hot-wallet,sweep-batch-001
ethereum,ETH,0.05,hot-wallet,42,gas-funding-042
```

---

## ✅ Best Practices

### Security

| Practice                  | Description                 |
| ------------------------- | --------------------------- |
| **Never commit keys**     | Add `.env` to `.gitignore`  |
| **Use hardware wallets**  | For production hot wallets  |
| **Restrict permissions**  | `chmod 600 .env`            |
| **Separate environments** | Use `.env.test` for testing |
| **Validate addresses**    | Always verify checksums     |

### Performance

| Practice               | Description                                |
| ---------------------- | ------------------------------------------ |
| **Batch operations**   | Use ranges instead of individual addresses |
| **Parallel execution** | Set `--parallel 10` for faster sweeps      |
| **Use Multicall3**     | Enabled by default for balance queries     |
| **Cache xpub**         | Avoid deriving from mnemonic repeatedly    |
| **Strategy detection** | Pre-configure token strategies in config   |

### Gas Optimization

| Practice               | Description                         |
| ---------------------- | ----------------------------------- |
| **Prefer EIP-3009**    | For USDC and compatible tokens      |
| **Use EIP-2612**       | For DAI, USDC.e, and modern tokens  |
| **Deploy HotSweep**    | Enable EIP-7702 for maximum savings |
| **Batch sweeps**       | Combine multiple tokens per address |
| **Monitor gas prices** | Sweep during low-gas periods        |

### Code Style

```typescript
// ✅ DO: Use type-safe imports
import type { Address, Hex } from "viem";
import type { HotSweepConfig, TransferOptions } from "@hotsweep/types";

// ✅ DO: Handle errors properly
try {
  const result = await executeTransfer(context, options);
  if (!result.success) {
    console.error(`Transfer failed: ${result.error.message}`);
  }
} catch (error) {
  if (error instanceof HotSweepError) {
    console.error(`HotSweep error [${error.code}]: ${error.message}`);
  }
}

// ❌ DON'T: Ignore error handling
const result = await executeTransfer(context, options);
console.log(result.tx.hash); // May crash if result.success is false
```

---

## 🔧 Troubleshooting

### Common Errors

| Error                  | Cause                          | Solution                           |
| ---------------------- | ------------------------------ | ---------------------------------- |
| `CHAIN_NOT_FOUND`      | Invalid chain identifier       | Check `sweep config get chains`    |
| `WALLET_NOT_FOUND`     | Unknown wallet label           | Verify wallet exists in config     |
| `TOKEN_NOT_FOUND`      | Token not configured           | Add token to config or use address |
| `INSUFFICIENT_BALANCE` | Not enough funds               | Check balance with `sweep balance` |
| `STRATEGY_UNSUPPORTED` | Token doesn't support strategy | Use `--strategy legacy`            |

### Debugging

```bash
# Dry run to test without executing
sweep transfer --from 42 --to hot-wallet --amount all --dry-run

# Verbose output
DEBUG=hotsweep:* sweep transfer ...

# Validate configuration
sweep config validate

# Check specific config values
sweep config get chains.eip155:1.rpcUrls
```

### Network Issues

```bash
# Test RPC connectivity
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://eth.merkle.io

# Switch RPC endpoint
sweep config set chains.eip155:1.rpcUrls.default.http.0 "https://new-rpc.com"
```

---

## 📚 API Reference

### Core Functions

```typescript
// Address Generation
generateAddresses(context, options): AddressGenerationResult
generateAddress(context, index): DerivedAddress

// Balance Queries
queryBalances(config, options): Promise<BalanceResult[]>
queryNativeBalance(client, address): Promise<bigint>
queryTokenBalance(client, tokenAddress, address): Promise<bigint>

// Transfer Execution
executeTransfer(context, options): Promise<TransferResult>
detectStrategy(client, tokenAddress, tokenConfig?): Promise<SweepStrategy>

// Configuration
loadConfig(path): HotSweepConfig
saveConfig(config, path): void
getByPath(config, path): unknown
setByPath(config, path, value): HotSweepConfig

// Wallet
generateMnemonic(strength?): string
validateMnemonic(mnemonic): boolean
mnemonicToSeed(mnemonic, passphrase?): Uint8Array
hdKeyFromMnemonic(mnemonic, passphrase?): HDKey
deriveAddress(hdKey, index, coinType?): DerivedAddress
```

### Type Definitions

```typescript
type SweepStrategy = "auto" | "eip7702" | "eip2612" | "eip3009" | "legacy";
type CAIP2ChainId = `eip155:${number}` | `bip122:${string}` | ...;
type OutputFormat = "json" | "csv" | "table" | "text";

interface TransferOptions {
  from: string | number | Address;
  to: string | number | Address;
  chain: string | number;
  token: string | Address;
  amount: string | "all";
  strategy?: SweepStrategy;
  dryRun?: boolean;
  reference?: string;
}

interface TransferResult {
  success: boolean;
  from: { identifier: string; address: Address };
  to: { identifier: string; address: Address };
  chain?: { id: number; name: string; caip2Id: CAIP2ChainId };
  token?: { symbol: string; address: Address };
  amount?: { value: string; raw: string };
  strategy?: SweepStrategy;
  tx?: { hash: Hex; blockNumber?: bigint; gasUsed?: bigint };
  error?: { code: string; message: string };
}
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**HotSweep v2.0.0** • Built with ❤️ for the crypto community

</div>
