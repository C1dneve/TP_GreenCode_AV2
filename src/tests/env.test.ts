import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config/env.js";

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db?schema=public",
  JWT_SECRET: "test-secret-that-is-long-enough-to-exceed-32-bytes",
};

test("loadConfig accepts a valid configuration", () => {
  const config = loadConfig(validEnv);
  assert.equal(config.port, 3000);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.nodeEnv, "test");
});

test("loadConfig rejects a malformed port", () => {
  assert.throws(() => loadConfig({ ...validEnv, PORT: "70000" }), /PORT/);
});

test("loadConfig rejects a weak JWT secret", () => {
  assert.throws(() => loadConfig({ ...validEnv, JWT_SECRET: "short" }), /JWT_SECRET/);
});

test("loadConfig rejects a missing database URL", () => {
  const { DATABASE_URL: _ignored, ...withoutDatabase } = validEnv;
  assert.throws(() => loadConfig(withoutDatabase), /DATABASE_URL/);
});
