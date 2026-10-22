import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const ids = {
  usuario: randomUUID(),
  usuarioDuplicado: randomUUID(),
  organizacao: randomUUID(),
  organizacaoDuplicada: randomUUID(),
  lote: randomUUID(),
  equipamentoBase: randomUUID(),
  semLote1: randomUUID(),
  semLote2: randomUUID(),
  codigoDuplicado: randomUUID(),
  posicaoDuplicada: randomUUID(),
  loteInexistente: randomUUID(),
  posicaoSemLote: randomUUID(),
  loteSemPosicao: randomUUID(),
};
const equipamentosParaLimpeza = [
  ids.equipamentoBase,
  ids.semLote1,
  ids.semLote2,
  ids.codigoDuplicado,
  ids.posicaoDuplicada,
  ids.loteInexistente,
  ids.posicaoSemLote,
  ids.loteSemPosicao,
];
const usuarioNome = `g0test-${runId}`;
const barcodeBase = `G0TEST-${runId}`;
const cnpj = `9${randomInt(0, 10 ** 13).toString().padStart(13, "0")}`;
let client: Client | undefined;
let databaseName: string | undefined;
let fixturesAllowed = false;

function equipmentSql(): string {
  return `INSERT INTO "equipamentos" (
    "id", "codigoBarrasInterno", "tipo", "marca", "modelo", "anoFabricacao",
    "estadoFisico", "pesoQuilogramas", "loteId", "posicaoNoLote", "updatedAt"
  ) VALUES ($1, $2, 'NOTEBOOK', 'G0 Test', 'Integration', 2024, 'BOM_ESTADO', 1.250, $3, $4, NOW())`;
}

async function insertEquipment(id: string, barcode: string, lotId: string | null, position: number | null): Promise<void> {
  assert.ok(client);
  await client.query(equipmentSql(), [id, barcode, lotId, position]);
}

async function assertPgConstraint(
  operation: Promise<unknown>,
  code: string,
  constraint: string,
): Promise<void> {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error, `A operação deveria falhar com constraint ${constraint}.`);
  const dbError = caught as Error & { code?: string; constraint?: string };
  assert.equal(dbError.code, code);
  assert.equal(dbError.constraint, constraint);
}

before(async () => {
  if (!databaseUrl) {
    throw new Error("Integração PostgreSQL bloqueada: defina DATABASE_URL para um banco dedicado cujo nome contenha 'test'.");
  }

  const parsed = new URL(databaseUrl);
  databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
    throw new Error("Segurança: os testes de integração só executam quando o nome do banco contém 'test'; nenhuma escrita foi feita.");
  }

  client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
  } catch {
    client = undefined;
    throw new Error("Integração PostgreSQL bloqueada: não foi possível conectar ao banco de teste. Verifique serviço, DATABASE_URL e migrações; a URL não foi exibida.");
  }

  const currentDb = await client.query<{ name: string }>("SELECT current_database() AS name");
  databaseName = currentDb.rows[0]?.name;
  if (!databaseName || !/(^|[_-])test($|[_-])/i.test(databaseName)) {
    throw new Error("Segurança: a conexão não corresponde a um banco de teste; nenhuma fixture será criada.");
  }
  fixturesAllowed = true;

  await client.query(
    `INSERT INTO "usuarios" ("id", "usuario", "nome", "senhaHash", "papel", "updatedAt")
     VALUES ($1, $2, 'G0 Integration User', 'not-a-real-hash-for-tests', 'ADMINISTRADOR', NOW())`,
    [ids.usuario, usuarioNome],
  );
  await client.query(
    `INSERT INTO "organizacoes" ("id", "razaoSocial", "cnpj", "updatedAt")
     VALUES ($1, 'G0 Integration Organization', $2, NOW())`,
    [ids.organizacao, cnpj],
  );
  await client.query(
    `INSERT INTO "lotes" ("id", "organizacaoId", "notaFiscal", "transportadora", "updatedAt")
     VALUES ($1, $2, $3, 'G0 Integration Carrier', NOW())`,
    [ids.lote, ids.organizacao, `G0-${runId}`],
  );
  await insertEquipment(ids.equipamentoBase, `${barcodeBase}-BASE`, ids.lote, 0);
});

after(async () => {
  if (!client) return;
  try {
    if (fixturesAllowed) {
      await client.query('DELETE FROM "equipamentos" WHERE "id" = ANY($1::uuid[])', [equipamentosParaLimpeza]);
      await client.query('DELETE FROM "lotes" WHERE "id" = $1', [ids.lote]);
      await client.query('DELETE FROM "organizacoes" WHERE "id" = ANY($1::uuid[])', [[ids.organizacao, ids.organizacaoDuplicada]]);
      await client.query('DELETE FROM "usuarios" WHERE "id" = ANY($1::uuid[])', [[ids.usuario, ids.usuarioDuplicado]]);
    }
  } finally {
    await client.end();
  }
});

test("migrações e seed disponibilizam os parâmetros globais com defaults aprovados", async () => {
  assert.ok(client);
  const result = await client.query<{ aliquota: string; depreciacao: string }>(
    `SELECT "aliquotaImpostoPercentual"::text AS aliquota,
            "taxaDepreciacaoAnualPercentual"::text AS depreciacao
       FROM "parametros_globais" WHERE "id" = 'global'`,
  );
  assert.equal(result.rows.length, 1, "Execute npm run db:seed duas vezes antes desta suíte.");
  assert.equal(result.rows[0]?.aliquota, "0.00");
  assert.equal(result.rows[0]?.depreciacao, "15.00");
});

test("PostgreSQL mantém o relacionamento lote-organização-equipamento válido", async () => {
  assert.ok(client);
  const result = await client.query<{ lote_id: string; organizacao_id: string; posicao: number }>(
    `SELECT e."loteId" AS lote_id, l."organizacaoId" AS organizacao_id, e."posicaoNoLote" AS posicao
       FROM "equipamentos" e JOIN "lotes" l ON l."id" = e."loteId"
      WHERE e."id" = $1`,
    [ids.equipamentoBase],
  );
  assert.deepEqual(result.rows, [{ lote_id: ids.lote, organizacao_id: ids.organizacao, posicao: 0 }]);
});

test("mais de um equipamento pode existir sem lote somente com posição NULL", async () => {
  await insertEquipment(ids.semLote1, `${barcodeBase}-NOLOT-1`, null, null);
  await insertEquipment(ids.semLote2, `${barcodeBase}-NOLOT-2`, null, null);
  assert.ok(client);
  const result = await client.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM "equipamentos" WHERE "id" = ANY($1::uuid[]) AND "loteId" IS NULL AND "posicaoNoLote" IS NULL',
    [[ids.semLote1, ids.semLote2]],
  );
  assert.equal(result.rows[0]?.total, 2);
});

test("PostgreSQL rejeita codigo de equipamento duplicado", async () => {
  await assertPgConstraint(
    insertEquipment(ids.codigoDuplicado, `${barcodeBase}-BASE`, ids.lote, 1),
    "23505",
    "equipamentos_codigoBarrasInterno_key",
  );
});

test("PostgreSQL rejeita posição duplicada no mesmo lote", async () => {
  await assertPgConstraint(
    insertEquipment(ids.posicaoDuplicada, `${barcodeBase}-DUP-POS`, ids.lote, 0),
    "23505",
    "equipamentos_loteId_posicaoNoLote_key",
  );
});

test("PostgreSQL rejeita CNPJ duplicado", async () => {
  assert.ok(client);
  await assertPgConstraint(
    client.query(
      `INSERT INTO "organizacoes" ("id", "razaoSocial", "cnpj", "updatedAt") VALUES ($1, 'G0 Duplicate', $2, NOW())`,
      [ids.organizacaoDuplicada, cnpj],
    ),
    "23505",
    "organizacoes_cnpj_key",
  );
});

test("PostgreSQL rejeita nome de usuário duplicado", async () => {
  assert.ok(client);
  await assertPgConstraint(
    client.query(
      `INSERT INTO "usuarios" ("id", "usuario", "nome", "senhaHash", "papel", "updatedAt") VALUES ($1, $2, 'G0 Duplicate', 'not-a-real-hash-for-tests', 'AUDITOR', NOW())`,
      [ids.usuarioDuplicado, usuarioNome],
    ),
    "23505",
    "usuarios_usuario_key",
  );
});

test("PostgreSQL rejeita referência a lote inexistente", async () => {
  await assertPgConstraint(
    insertEquipment(ids.loteInexistente, `${barcodeBase}-BAD-FK`, ids.loteInexistente, 1),
    "23503",
    "equipamentos_loteId_fkey",
  );
});

test("PostgreSQL rejeita lote e posição inconsistentes em qualquer direção", async () => {
  await assertPgConstraint(
    insertEquipment(ids.posicaoSemLote, `${barcodeBase}-POS-NOLOT`, null, 7),
    "23514",
    "equipamentos_lote_posicao_consistencia_check",
  );
  await assertPgConstraint(
    insertEquipment(ids.loteSemPosicao, `${barcodeBase}-LOT-NOPOS`, ids.lote, null),
    "23514",
    "equipamentos_lote_posicao_consistencia_check",
  );
});
