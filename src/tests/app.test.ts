import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';

test('GET /health informa que o servidor estÃ¡ respondendo', async (t) => {
  const app = buildApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'greencode-api' });
});

test('documentaÃ§Ã£o OpenAPI estÃ¡ acessÃ­vel', async (t) => {
  const app = buildApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/docs/json' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().info.title, 'GreenCode API');
});
