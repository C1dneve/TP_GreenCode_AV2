import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { buildApp } from "../../app.js";
import { createPrismaClient } from "../../infrastructure/database/prisma.js";

const databaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const actorId = randomUUID();
const adminUsername = `critical-e2e-${suffix}`;
const adminPassword = `Critical-E2E-${randomUUID()}-Ok`;
const jwtSecret = "critical-integration-only-jwt-secret-with-more-than-32-bytes";
const organizationIds: string[] = [];
const lotIds: string[] = [];
const equipmentIds: string[] = [];
let prisma: PrismaClient | undefined;
let app: FastifyInstance | undefined;
let fixtureOwnerCreated = false;

function validCnpj(): string {
  const base = String(randomInt(0, 1_000_000_000_000)).padStart(12, "0");
  const digit = (value: string, weights: number[]) => {
    const sum = [...value].reduce((total, char, index) => total + Number(char) * weights[index]!, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${first}${second}`;
}

function authorized(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function login(): Promise<string> {
  assert.ok(app, "Fastify deveria estar inicializado");
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { usuario: adminUsername, senha: adminPassword },
  });
  assert.equal(response.statusCode, 200, response.body);
  const token = response.json().accessToken as string;
  assert.ok(token, "O login deve emitir accessToken");
  return token;
}

async function createEquipmentScenario(token: string) {
  assert.ok(app);
  const organization = await app.inject({
    method: "POST",
    url: "/api/v1/organizacoes",
    headers: authorized(token),
    payload: {
      razaoSocial: `Organização crítica ${randomUUID().slice(0, 8)}`,
      cnpj: validCnpj(),
      email: "critical-e2e@example.test",
    },
  });
  assert.equal(organization.statusCode, 201, organization.body);
  const organizationId = organization.json().id as string;
  organizationIds.push(organizationId);

  const lot = await app.inject({
    method: "POST",
    url: "/api/v1/lotes",
    headers: authorized(token),
    payload: {
      organizacaoId: organizationId,
      dataEntrada: new Date().toISOString(),
      notaFiscal: `CRITICAL-${randomUUID().slice(0, 12)}`,
      transportadora: "Transportadora de teste",
    },
  });
  assert.equal(lot.statusCode, 201, lot.body);
  const lotId = lot.json().id as string;
  lotIds.push(lotId);

  const equipment = await app.inject({
    method: "POST",
    url: "/api/v1/equipamentos",
    headers: authorized(token),
    payload: {
      loteId: lotId,
      tipo: "NOTEBOOK",
      marca: "GreenCode",
      modelo: "Critical integration fixture",
      anoFabricacao: 2024,
      estadoFisico: "BOM_ESTADO",
      pesoQuilogramas: "2.500",
      valorAquisicao: "500.00",
    },
  });
  assert.equal(equipment.statusCode, 201, equipment.body);
  const equipmentId = equipment.json().id as string;
  equipmentIds.push(equipmentId);
  return { organizationId, lotId, equipmentId, lot: lot.json(), equipment: equipment.json() };
}

before(async () => {
  if (!databaseUrl) {
    throw new Error("Integração crítica bloqueada: DATABASE_URL deve apontar para uma base dedicada com 'test' no nome.");
  }
  const parsed = new URL(databaseUrl);
  const configuredName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(^|[_-])test($|[_-])/i.test(configuredName)) {
    throw new Error("Segurança: integração crítica recusada porque o nome configurado da base não contém 'test'. Nenhuma fixture foi criada.");
  }

  prisma = createPrismaClient(databaseUrl);
  await prisma.$connect();
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  const actualName = rows[0]?.name;
  if (!actualName || !/(^|[_-])test($|[_-])/i.test(actualName)) {
    await prisma.$disconnect();
    prisma = undefined;
    throw new Error("Segurança: a conexão real não corresponde a uma base de teste. Nenhuma fixture foi criada.");
  }

  const senhaHash = await bcrypt.hash(adminPassword, 4);
  await prisma.usuario.create({
    data: {
      id: actorId,
      usuario: adminUsername,
      nome: "Administrador de testes críticos",
      senhaHash,
      papel: "ADMINISTRADOR",
      ativo: true,
    },
  });
  fixtureOwnerCreated = true;
  process.env.NODE_ENV = "test";
  app = buildApp({ prisma, jwtSecret });
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (!prisma) return;
  try {
    if (fixtureOwnerCreated) {
      const allEntityIds = [...organizationIds, ...lotIds, ...equipmentIds];
      await prisma.eventoAuditoria.deleteMany({
        where: { OR: [{ atorUsuarioId: actorId }, { entidadeId: { in: allEntityIds } }] },
      });
      await prisma.tokenRevogado.deleteMany({ where: { usuarioId: actorId } });
      if (equipmentIds.length) await prisma.movimentacao.deleteMany({ where: { equipamentoId: { in: equipmentIds } } });
      if (equipmentIds.length) await prisma.equipamento.deleteMany({ where: { id: { in: equipmentIds } } });
      if (lotIds.length) await prisma.lote.deleteMany({ where: { id: { in: lotIds } } });
      if (organizationIds.length) await prisma.organizacao.deleteMany({ where: { id: { in: organizationIds } } });
      await prisma.usuario.deleteMany({ where: { id: actorId } });
    }
  } finally {
    await prisma.$disconnect();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("logout revoga efetivamente o mesmo JWT nas rotas protegidas", async () => {
  assert.ok(app);
  const token = await login();

  const logout = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: authorized(token),
  });
  assert.equal(logout.statusCode, 204, logout.body);

  const subsequentRequest = await app.inject({
    method: "GET",
    url: "/api/v1/auth/me",
    headers: authorized(token),
  });
  assert.equal(subsequentRequest.statusCode, 401, subsequentRequest.body);
  assert.equal(subsequentRequest.json().error.code, "UNAUTHENTICATED");
});

test("concorrência otimista rejeita versão obsoleta e preserva a primeira atualização", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const staleVersion = fixture.equipment.versao as number;

  const firstUpdate = await app.inject({
    method: "PATCH",
    url: `/api/v1/equipamentos/${fixture.equipmentId}`,
    headers: authorized(token),
    payload: { versaoEsperada: staleVersion, marca: "Marca Primeira Atualização" },
  });
  assert.equal(firstUpdate.statusCode, 200, firstUpdate.body);
  assert.equal(firstUpdate.json().marca, "Marca Primeira Atualização");
  assert.equal(firstUpdate.json().versao, staleVersion + 1);

  const staleUpdate = await app.inject({
    method: "PATCH",
    url: `/api/v1/equipamentos/${fixture.equipmentId}`,
    headers: authorized(token),
    payload: { versaoEsperada: staleVersion, marca: "Marca Obsoleta Não Deve Persistir" },
  });
  assert.equal(staleUpdate.statusCode, 409, staleUpdate.body);
  assert.equal(staleUpdate.json().error.code, "VERSION_CONFLICT");

  const persisted = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(persisted, "O equipamento atualizado deve continuar persistido");
  assert.equal(persisted.marca, "Marca Primeira Atualização");
  assert.notEqual(persisted.marca, "Marca Obsoleta Não Deve Persistir");
  assert.equal(persisted.versao, staleVersion + 1);
});

test("falha controlada na auditoria reverte a triagem inteira e não persiste auditoria parcial", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const lotId = fixture.lotId;
  const triggerSuffix = randomUUID().replaceAll("-", "");
  const functionName = `test_abort_triage_audit_${triggerSuffix}`;
  const triggerName = `test_abort_triage_audit_${triggerSuffix}`;
  let triggerInstalled = false;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger
      LANGUAGE plpgsql AS $test_body$
      BEGIN
        IF NEW."acao" = 'TRIAGEM_LOTE'
          AND NEW."entidade" = 'Lote'
          AND NEW."entidadeId" = '${lotId}' THEN
          RAISE EXCEPTION 'controlled rollback integration failure';
        END IF;
        RETURN NEW;
      END;
      $test_body$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON "eventos_auditoria"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);
    triggerInstalled = true;

    const triage = await app.inject({
      method: "POST",
      url: `/api/v1/lotes/${lotId}/triagem`,
      headers: authorized(token),
      payload: { versaoEsperada: fixture.lot.versao },
    });
    assert.equal(triage.statusCode, 500, triage.body);
    assert.equal(triage.json().error.code, "INTERNAL_ERROR");

    const persistedLot = await prisma.lote.findUnique({ where: { id: lotId } });
    const persistedEquipment = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    const triageAudits = await prisma.eventoAuditoria.count({
      where: { acao: "TRIAGEM_LOTE", entidade: "Lote", entidadeId: lotId },
    });

    assert.ok(persistedLot);
    assert.ok(persistedEquipment);
    assert.equal(persistedLot.statusProcessamento, "RECEBIDO");
    assert.equal(persistedLot.versao, fixture.lot.versao);
    assert.equal(persistedEquipment.statusRastreamento, "AGUARDANDO_TRIAGEM");
    assert.equal(persistedEquipment.versao, fixture.equipment.versao);
    assert.equal(triageAudits, 0, "O evento da transação abortada não deve permanecer na auditoria");
  } finally {
    if (triggerInstalled) {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "eventos_auditoria"`);
    }
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
  }
});


test("finalização prematura de lote retorna 409 e preserva o estado", async () => {
  assert.ok(app, "Fastify deveria estar inicializado");
  assert.ok(prisma, "Prisma deveria estar inicializado");

  const application = app;
  const db = prisma;
  const token = await login();

  // Reutiliza a fixture existente e registra os IDs para a limpeza automática.
  const scenario = await createEquipmentScenario(token);

  const before = await db.lote.findUnique({
    where: { id: scenario.lotId },
    select: {
      statusProcessamento: true,
      versao: true,
    },
  });

  assert.ok(before, "O lote de teste deveria existir");
  assert.equal(before.statusProcessamento, "RECEBIDO");

  const response = await application.inject({
    method: "POST",
    url: `/api/v1/lotes/${scenario.lotId}/finalizacao`,
    headers: authorized(token),
    payload: {
      versaoEsperada: before.versao,
    },
  });

  assert.equal(response.statusCode, 409, response.body);
  assert.equal(
    response.json().error.code,
    "INVALID_STATE_TRANSITION",
    response.body,
  );

  // Confirma diretamente no PostgreSQL que a operação não alterou o lote.
  const after = await db.lote.findUnique({
    where: { id: scenario.lotId },
    select: {
      statusProcessamento: true,
      versao: true,
    },
  });

  assert.deepEqual(after, before);
});
