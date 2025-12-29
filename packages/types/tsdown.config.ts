import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "init.types": "src/init.types.ts",
    "address.types": "src/address.types.ts",
    "balance.types": "src/balance.types.ts",
    "transfer.types": "src/transfer.types.ts",
    "config.types": "src/config.types.ts",
    "api.types": "src/api.types.ts",
    "cache.types": "src/cache.types.ts",
    "errors.types": "src/errors.types.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  platform: "neutral",
  treeshake: true,
  minify: false, // Keep readable for types
});
