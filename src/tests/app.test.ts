import { after, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";

const app = buildApp();
after(async () => app.close());

test("GET /health retorna estado básico do serviço", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok", service: "greencode-api" });
});

test("Swagger publica o documento OpenAPI em /docs/json", async () => {
  const response = await app.inject({ method: "GET", url: "/docs/json" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().info.title, "GreenCode API");
  assert.ok(response.json().paths["/health"]);
});

test("rota inexistente retorna erro JSON com requestId", async () => {
  const response = await app.inject({ method: "GET", url: "/nao-existe" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "NOT_FOUND");
  assert.ok(response.json().error.requestId);
});
