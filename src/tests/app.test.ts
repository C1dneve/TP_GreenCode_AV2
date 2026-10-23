import { after, test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../app.js";

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";
const app = buildApp();
if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;

app.get("/__test/validation", {
  schema: {
    querystring: {
      type: "object",
      properties: { count: { type: "integer" } },
      required: ["count"],
      additionalProperties: false,
    },
  },
}, async () => ({ ok: true }));
app.get("/__test/internal-error", async () => {
  throw new Error("internal sentinel must not reach the client");
});

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


test("Swagger UI em /docs/ responde com HTML", async () => {
  const response = await app.inject({ method: "GET", url: "/docs/" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /text\/html/);
});

test("erro de validação usa envelope HTTP uniforme", async () => {
  const response = await app.inject({ method: "GET", url: "/__test/validation?count=nao-inteiro" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
  assert.equal(response.json().error.message, "A requisição contém campos inválidos.");
  assert.ok(response.json().error.requestId);
  assert.ok(Array.isArray(response.json().error.details));
});

test("erro interno não expõe detalhes da exceção ao cliente", async () => {
  const response = await app.inject({ method: "GET", url: "/__test/internal-error" });
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error.code, "INTERNAL_ERROR");
  assert.equal(response.json().error.message, "Ocorreu um erro interno.");
  assert.ok(response.json().error.requestId);
  assert.doesNotMatch(response.body, /internal sentinel/);
});
