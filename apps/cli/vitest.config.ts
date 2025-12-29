import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "test/",
        "**/*.test.ts",
        "src/bin/**",
      ],
    },
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/", "dist/"],
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@hotsweep/core": resolve(__dirname, "../../packages/core/src/index.ts"),
      "@hotsweep/types": resolve(
        __dirname,
        "../../packages/types/src/index.ts"
      ),
    },
  },
});
