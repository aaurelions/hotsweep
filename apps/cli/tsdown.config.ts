import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/sweep": "src/bin/sweep.ts",
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
    "@hotsweep/core",
    "@hotsweep/types",
    "commander",
    "chalk",
    "ora",
    "inquirer",
    "cli-table3",
    "dotenv",
    "fast-csv",
  ],
});
