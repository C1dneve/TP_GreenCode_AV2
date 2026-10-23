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
const adminUsername = `av2-e2e-${suffix}`;
const adminPassword = `E2E-Pass-${randomUUID()}-OK`;
const actorId = randomUUID();
let prisma: PrismaClient | undefined;
let app: FastifyInstance | undefined;
let organizationId: string | undefined;
let contractId: string | undefined;
let lotId: string | undefined;
let equipmentId: string | undefined;
let readyForCleanup = false;

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

function authorized(token: string) { return { authorization: `Bearer ${token}` }; }

before(async () => {
  if (!databaseUrl) throw new Error("Integração HTTP bloqueada: DATABASE_URL deve apontar para uma base dedicada com 'test' no nome.");
  const parsed = new URL(databaseUrl);
  const configuredName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(^|[_-])test($|[_-])/i.test(configuredName)) throw new Error("Segurança: integração HTTP recusada porque o nome configurado da base não contém 'test'. Nenhuma fixture foi criada.");

  prisma = createPrismaClient(databaseUrl);
  await prisma.$connect();
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  const actualName = rows[0]?.name;
  if (!actualName || !/(^|[_-])test($|[_-])/i.test(actualName)) {
    await prisma.$disconnect();
    prisma = undefined;
    throw new Error("Segurança: a conexão real não corresponde a uma base de teste. Nenhuma fixture foi criada.");
  }

  const senhaHash = await bcrypt.hash(adminPassword, 12);
  await prisma.usuario.create({
    data: { id: actorId, usuario: adminUsername, nome: "Administrador E2E", senhaHash, papel: "ADMINISTRADOR", ativo: true },
  });
  readyForCleanup = true;
  process.env.NODE_ENV = "test";
  app = buildApp({ prisma, jwtSecret: "integration-only-jwt-secret-with-more-than-32-bytes" });
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (!prisma) return;
  try {
    if (readyForCleanup) {
      await prisma.eventoAuditoria.deleteMany({ where: { OR: [{ atorUsuarioId: actorId }, { entidadeId: { in: [organizationId, contractId, lotId, equipmentId].filter((x): x is string => Boolean(x)) } }] } });
      if (equipmentId) await prisma.movimentacao.deleteMany({ where: { equipamentoId: equipmentId } });
      if (equipmentId) await prisma.equipamento.deleteMany({ where: { id: equipmentId } });
      if (lotId) await prisma.lote.deleteMany({ where: { id: lotId } });
      if (contractId) await prisma.contrato.deleteMany({ where: { id: contractId } });
      if (organizationId) await prisma.organizacao.deleteMany({ where: { id: organizationId } });
      await prisma.usuario.deleteMany({ where: { id: actorId } });
    }
  } finally {
    await prisma.$disconnect();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("jornada HTTP real: organização → contrato → lote → equipamento → triagem → movimentação", async () => {
  assert.ok(app, "Fastify deveria estar inicializado");
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { usuario: adminUsername, senha: adminPassword } });
  assert.equal(login.statusCode, 200, login.body);
  const token = login.json().accessToken as string;
  assert.ok(token);

  const organization = await app.inject({
    method: "POST", url: "/api/v1/organizacoes", headers: authorized(token),
    payload: { razaoSocial: `Organização E2E ${suffix}`, cnpj: validCnpj(), email: "e2e@example.test" },
  });
  assert.equal(organization.statusCode, 201, organization.body);
  organizationId = organization.json().id as string;
  assert.equal(organization.json().ativo, true);

  const contract = await app.inject({
    method: "POST", url: `/api/v1/organizacoes/${organizationId}/contratos`, headers: authorized(token),
    payload: { dataVencimento: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), valorMensal: "1250.00", clausulas: ["Contrato de integração"], renovacaoAutomatica: false },
  });
  assert.equal(contract.statusCode, 201, contract.body);
  contractId = contract.json().id as string;
  assert.equal(contract.json().status, "VIGENTE");

  const note = `E2E-${suffix}`;
  const lot = await app.inject({
    method: "POST", url: "/api/v1/lotes", headers: authorized(token),
    payload: { organizacaoId: organizationId, dataEntrada: new Date().toISOString(), notaFiscal: note, transportadora: "Transportadora E2E" },
  });
  assert.equal(lot.statusCode, 201, lot.body);
  lotId = lot.json().id as string;
  assert.equal(lot.json().statusProcessamento, "RECEBIDO");

  const equipment = await app.inject({
    method: "POST", url: "/api/v1/equipamentos", headers: authorized(token),
    payload: { loteId: lotId, tipo: "NOTEBOOK", marca: "GreenCode", modelo: "E2E Model", anoFabricacao: 2023, estadoFisico: "BOM_ESTADO", pesoQuilogramas: "3.125", valorAquisicao: "900.00" },
  });
  assert.equal(equipment.statusCode, 201, equipment.body);
  equipmentId = equipment.json().id as string;
  assert.equal(equipment.json().statusRastreamento, "AGUARDANDO_TRIAGEM");

  const triage = await app.inject({ method: "POST", url: `/api/v1/lotes/${lotId}/triagem`, headers: authorized(token), payload: { versaoEsperada: lot.json().versao } });
  assert.equal(triage.statusCode, 200, triage.body);
  assert.equal(triage.json().statusProcessamento, "TRIAGEM_CONCLUIDA");
  const triagedEquipment = await app.inject({ method: "GET", url: `/api/v1/equipamentos/${equipmentId}`, headers: authorized(token) });
  assert.equal(triagedEquipment.statusCode, 200, triagedEquipment.body);
  assert.equal(triagedEquipment.json().statusRastreamento, "AGUARDANDO_DESMONTE");

  const movement = await app.inject({
    method: "POST", url: `/api/v1/equipamentos/${equipmentId}/movimentacoes`, headers: authorized(token),
    payload: { destino: "Almoxarifado Central", observacao: "Movimentação de homologação E2E" },
  });
  assert.equal(movement.statusCode, 201, movement.body);
  assert.equal(movement.json().origem, `Lote ${note}`);
  assert.equal(movement.json().responsavelNomeSnapshot, "Administrador E2E");

  const history = await app.inject({ method: "GET", url: `/api/v1/equipamentos/${equipmentId}/movimentacoes`, headers: authorized(token) });
  assert.equal(history.statusCode, 200, history.body);
  assert.equal(history.json().meta.total, 1);

  const periodStart = new Date(Date.now() - 60_000).toISOString();
  const periodEnd = new Date(Date.now() + 60_000).toISOString();
  const report = await app.inject({ method: "GET", url: `/api/v1/relatorios/operacionais?organizacaoId=${organizationId}&de=${encodeURIComponent(periodStart)}&ate=${encodeURIComponent(periodEnd)}`, headers: authorized(token) });
  assert.equal(report.statusCode, 200, report.body);
  assert.equal(report.json().totalLotes, 1);
  assert.equal(report.json().totalEquipamentos, 1);

  assert.ok(prisma);
  const persistedEquipment = await prisma.equipamento.findUnique({ where: { id: equipmentId } });
  assert.equal(persistedEquipment?.statusRastreamento, "AGUARDANDO_DESMONTE");
  const audits = await prisma.eventoAuditoria.count({ where: { atorUsuarioId: actorId } });
  assert.ok(audits >= 5, `Esperava eventos de auditoria persistidos, obtidos: ${audits}`);
});
