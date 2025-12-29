import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    wallet: "src/wallet/index.ts",
    address: "src/address/index.ts",
    config: "src/config/index.ts",
    chain: "src/chain/index.ts",
    balance: "src/balance/index.ts",
    transfer: "src/transfer/index.ts",
    init: "src/init/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "node",
  target: "node20",
  treeshake: true,
  minify: false,
  external: [
    "viem",
    "@hotsweep/types",
    "@scure/bip32",
    "@scure/bip39",
    "lru-cache",
    "dotenv",
    "zod",
  ],
});
