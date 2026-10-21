import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config/env.js";
import { getBootstrapAdminConfig } from "../config/bootstrap-admin.js";

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


test("loadConfig rejects a malformed PostgreSQL URL without exposing its content", () => {
  const secretConnectionUrl = "postgresql://demo-secret@/missing-host";
  assert.throws(
    () => loadConfig({ ...validEnv, DATABASE_URL: secretConnectionUrl }),
    (error: unknown) => error instanceof Error
      && /DATABASE_URL/.test(error.message)
      && !error.message.includes("demo-secret"),
  );
});

test("bootstrap admin does not configure a user when all three fields are absent", () => {
  assert.equal(getBootstrapAdminConfig({}), null);
});

test("bootstrap admin rejects partial configuration without echoing secret values", () => {
  const secret = "sensitive-bootstrap-password";
  assert.throws(
    () => getBootstrapAdminConfig({ BOOTSTRAP_ADMIN_PASSWORD: secret }),
    (error: unknown) => error instanceof Error
      && /BOOTSTRAP_ADMIN_USERNAME/.test(error.message)
      && !error.message.includes(secret),
  );
});

test("bootstrap admin requires a sufficiently long explicitly configured password", () => {
  assert.throws(() => getBootstrapAdminConfig({
    BOOTSTRAP_ADMIN_USERNAME: "Admin.User",
    BOOTSTRAP_ADMIN_NAME: "Admin User",
    BOOTSTRAP_ADMIN_PASSWORD: "too-short",
  }), /pelo menos 12 caracteres/);
});

test("bootstrap admin normalizes username but preserves the configured password", () => {
  const result = getBootstrapAdminConfig({
    BOOTSTRAP_ADMIN_USERNAME: "  Admin.User  ",
    BOOTSTRAP_ADMIN_NAME: "  Admin User  ",
    BOOTSTRAP_ADMIN_PASSWORD: "long-password-for-test-only",
  });
  assert.deepEqual(result, {
    usuario: "admin.user",
    nome: "Admin User",
    senha: "long-password-for-test-only",
  });
});
