import { beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";

// Load test environment variables
beforeAll(() => {
  dotenv.config({ path: ".env.test" });

  // Set test-specific ENV
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
});

afterAll(() => {
  // Cleanup if needed
});
