import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { buildApp } from "../../app.js";
import { createPrismaClient } from "../../infrastructure/database/prisma.js";

type InjectResponse = Awaited<
  ReturnType<FastifyInstance["inject"]>
>;

const databaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const actorId = randomUUID();
const adminUsername = `critical-e2e-${suffix}`;
const adminPassword = `Critical-E2E-${randomUUID()}-Ok`;
const jwtSecret = "critical-integration-only-jwt-secret-with-more-than-32-bytes";
const organizationIds: string[] = [];
const lotIds: string[] = [];
const contractIds: string[] = [];
const equipmentIds: string[] = [];
const userIds: string[] = [];
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
      const allEntityIds = [...organizationIds, ...lotIds, ...contractIds, ...equipmentIds, ...userIds];
      await prisma.eventoAuditoria.deleteMany({
        where: { OR: [{ atorUsuarioId: actorId }, { entidadeId: { in: allEntityIds } }] },
      });
      await prisma.tokenRevogado.deleteMany({ where: { usuarioId: actorId } });
      if (equipmentIds.length) await prisma.movimentacao.deleteMany({ where: { equipamentoId: { in: equipmentIds } } });
      if (equipmentIds.length) await prisma.equipamento.deleteMany({ where: { id: { in: equipmentIds } } });
      if (lotIds.length) await prisma.lote.deleteMany({ where: { id: { in: lotIds } } });
      if (contractIds.length) await prisma.contrato.deleteMany({ where: { id: { in: contractIds } } });
      if (organizationIds.length) await prisma.organizacao.deleteMany({ where: { id: { in: organizationIds } } });
      if (userIds.length) {
      await prisma.usuario.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    await prisma.parametroGlobal.updateMany({
      where: { atualizadoPorId: actorId },
      data: { atualizadoPorId: null },
    });

    await prisma.usuario.deleteMany({
      where: { id: actorId },
    });
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


test("desvincula equipamento elegível, limpa lote e posição, incrementa versão e audita atomicamente", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const before = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(before);
  assert.ok(before.loteId);
  assert.ok(before.posicaoNoLote);

  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/equipamentos/${fixture.equipmentId}`,
    headers: authorized(token),
    payload: { versaoEsperada: before.versao, loteId: null },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().loteId, null);
  assert.equal(response.json().posicaoNoLote, null);
  assert.equal(response.json().versao, before.versao + 1);

  const persisted = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(persisted);
  assert.equal(persisted.loteId, null);
  assert.equal(persisted.posicaoNoLote, null);
  assert.equal(persisted.versao, before.versao + 1);
  const audit = await prisma.eventoAuditoria.findFirst({
    where: { acao: "DESVINCULACAO_EQUIPAMENTO", entidade: "Equipamento", entidadeId: fixture.equipmentId, resultado: "SUCESSO" },
  });
  assert.ok(audit, "A desvinculação persistida precisa registrar auditoria de sucesso");
});

test("omitir loteId preserva vínculo e posição atuais durante outra atualização", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const before = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(before);
  const response = await app.inject({
    method: "PATCH",
    url: `/api/v1/equipamentos/${fixture.equipmentId}`,
    headers: authorized(token),
    payload: { versaoEsperada: before.versao, marca: "Marca sem alteração de lote" },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().loteId, before.loteId);
  assert.equal(response.json().posicaoNoLote, before.posicaoNoLote);
  const persisted = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(persisted);
  assert.equal(persisted.loteId, before.loteId);
  assert.equal(persisted.posicaoNoLote, before.posicaoNoLote);
});

test("desvinculação é rejeitada após o início de triagem ou quando existe movimentação", async (t) => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();

  await t.test("estado operacional após triagem", async () => {
    const fixture = await createEquipmentScenario(token);
    const triage = await app!.inject({ method: "POST", url: `/api/v1/lotes/${fixture.lotId}/triagem`, headers: authorized(token), payload: { versaoEsperada: fixture.lot.versao } });
    assert.equal(triage.statusCode, 200, triage.body);
    const current = await prisma!.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    assert.ok(current);
    const response = await app!.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: current.versao, loteId: null } });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error.code, "EQUIPMENT_CANNOT_UNLINK_LOT");
    const after = await prisma!.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    assert.ok(after);
    assert.equal(after.loteId, current.loteId);
    assert.equal(after.posicaoNoLote, current.posicaoNoLote);
    assert.equal(after.versao, current.versao);
  });

  await t.test("histórico de movimentação presente", async () => {
    const fixture = await createEquipmentScenario(token);
    const movement = await app!.inject({ method: "POST", url: `/api/v1/equipamentos/${fixture.equipmentId}/movimentacoes`, headers: authorized(token), payload: { destino: "Destino de teste", observacao: "Bloqueia desvinculação" } });
    assert.equal(movement.statusCode, 201, movement.body);
    const current = await prisma!.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    assert.ok(current);
    const response = await app!.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: current.versao, loteId: null } });
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error.code, "EQUIPMENT_CANNOT_UNLINK_LOT");
    const after = await prisma!.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    assert.ok(after);
    assert.equal(after.loteId, current.loteId);
    assert.equal(after.posicaoNoLote, current.posicaoNoLote);
    assert.equal(after.versao, current.versao);
  });
});

test("duas atualizações concorrentes com a mesma versão só permitem uma gravação", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const current = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(current);
  const [a, b] = await Promise.all([
    app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: current.versao, marca: "Concorrente A" } }),
    app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: current.versao, marca: "Concorrente B" } }),
  ]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [200, 409]);
  const persisted = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(persisted);
  assert.equal(persisted.versao, current.versao + 1);
  assert.ok(["Concorrente A", "Concorrente B"].includes(persisted.marca));
});

test("operações de ciclo de vida e alteração de estado rejeitam versões obsoletas sem alterar os registros", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);

  const organization = await prisma.organizacao.findUnique({ where: { id: fixture.organizationId } });
  assert.ok(organization);
  const organizationUpdate = await app.inject({ method: "PATCH", url: `/api/v1/organizacoes/${fixture.organizationId}`, headers: authorized(token), payload: { versaoEsperada: organization.versao, telefone: "11987654321" } });
  assert.equal(organizationUpdate.statusCode, 200, organizationUpdate.body);
  const staleOrganizationUpdate = await app.inject({ method: "PATCH", url: `/api/v1/organizacoes/${fixture.organizationId}`, headers: authorized(token), payload: { versaoEsperada: organization.versao, email: "stale-organization@example.test" } });
  assert.equal(staleOrganizationUpdate.statusCode, 409, staleOrganizationUpdate.body);
  for (const action of ["desativacao", "reativacao"] as const) {
    const response: InjectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/organizacoes/${fixture.organizationId}/${action}`,
      headers: authorized(token),
      payload: { versaoEsperada: organization.versao },
    });

    assert.equal(response.statusCode, 409, response.body);
    assert.equal(response.json().error.code, "VERSION_CONFLICT");
  }
  const organizationAfter = await prisma.organizacao.findUnique({ where: { id: fixture.organizationId } });
  assert.ok(organizationAfter);
  assert.equal(organizationAfter.ativo, true);
  assert.equal(organizationAfter.versao, organization.versao + 1);

  const equipment = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(equipment);
  const equipmentUpdate = await app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: equipment.versao, marca: "Marca com versão atualizada" } });
  assert.equal(equipmentUpdate.statusCode, 200, equipmentUpdate.body);
  const staleEquipmentUpdate = await app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: equipment.versao, marca: "Marca obsoleta" } });
  assert.equal(staleEquipmentUpdate.statusCode, 409, staleEquipmentUpdate.body);
  const physical = await app.inject({ method: "POST", url: `/api/v1/equipamentos/${fixture.equipmentId}/estado-fisico`, headers: authorized(token), payload: { versaoEsperada: equipment.versao, estadoFisico: "DANIFICADO_LEVE", justificativa: "Teste de versão obsoleta" } });
  assert.equal(physical.statusCode, 409, physical.body);
  const tracking = await app.inject({ method: "POST", url: `/api/v1/equipamentos/${fixture.equipmentId}/status-rastreamento`, headers: authorized(token), payload: { versaoEsperada: equipment.versao, statusRastreamento: "EM_TRIAGEM", justificativa: "Teste de versão obsoleta" } });
  assert.equal(tracking.statusCode, 409, tracking.body);
  for (const action of ["desativacao", "reativacao"] as const) {
    const response: InjectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/equipamentos/${fixture.equipmentId}/${action}`,
      headers: authorized(token),
      payload: { versaoEsperada: equipment.versao },
    });

    assert.equal(response.statusCode, 409, response.body);
  }
  const equipmentAfter = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(equipmentAfter);
  assert.equal(equipmentAfter.ativo, true);
  assert.equal(equipmentAfter.estadoFisico, equipment.estadoFisico);
  assert.equal(equipmentAfter.versao, equipment.versao + 1);

  const lot = await prisma.lote.findUnique({ where: { id: fixture.lotId } });
  assert.ok(lot);
  const lotUpdate = await app.inject({ method: "PATCH", url: `/api/v1/lotes/${fixture.lotId}`, headers: authorized(token), payload: { versaoEsperada: lot.versao, observacoes: "Versão atualizada antes das transições" } });
  assert.equal(lotUpdate.statusCode, 200, lotUpdate.body);
  const staleLotUpdate = await app.inject({ method: "PATCH", url: `/api/v1/lotes/${fixture.lotId}`, headers: authorized(token), payload: { versaoEsperada: lot.versao, observacoes: "Alteração obsoleta não deve persistir" } });
  assert.equal(staleLotUpdate.statusCode, 409, staleLotUpdate.body);
  const lotActions = [
    "triagem",
    "encaminhamento",
    "finalizacao",
    "desativacao",
    "reativacao",
  ] as const;

  for (const action of lotActions) {
    const response: InjectResponse = await app.inject({
      method: "POST",
      url: `/api/v1/lotes/${fixture.lotId}/${action}`,
      headers: authorized(token),
      payload: { versaoEsperada: lot.versao },
    });

    assert.equal(response.statusCode, 409, `${action}: ${response.body}`);
    assert.equal(response.json().error.code, "VERSION_CONFLICT");
  }
  const lotAfter = await prisma.lote.findUnique({ where: { id: fixture.lotId } });
  assert.ok(lotAfter);
  assert.equal(lotAfter.statusProcessamento, "RECEBIDO");
  assert.equal(lotAfter.versao, lot.versao + 1);

  const contractResponse = await app.inject({ method: "POST", url: `/api/v1/organizacoes/${fixture.organizationId}/contratos`, headers: authorized(token), payload: { dataVencimento: new Date(Date.now() + 90 * 86400000).toISOString(), valorMensal: "100.00" } });
  assert.equal(contractResponse.statusCode, 201, contractResponse.body);
  const contractId = contractResponse.json().id as string;
  contractIds.push(contractId);
  const contract = await prisma.contrato.findUnique({ where: { id: contractId } });
  assert.ok(contract);
  const contractUpdate = await app.inject({ method: "PATCH", url: `/api/v1/contratos/${contractId}`, headers: authorized(token), payload: { versaoEsperada: contract.versao, renovacaoAutomatica: true } });
  assert.equal(contractUpdate.statusCode, 200, contractUpdate.body);
  const staleContractUpdate = await app.inject({ method: "PATCH", url: `/api/v1/contratos/${contractId}`, headers: authorized(token), payload: { versaoEsperada: contract.versao, renovacaoAutomatica: false } });
  assert.equal(staleContractUpdate.statusCode, 409, staleContractUpdate.body);
  const cancel = await app.inject({ method: "POST", url: `/api/v1/contratos/${contractId}/cancelamento`, headers: authorized(token), payload: { versaoEsperada: contract.versao } });
  assert.equal(cancel.statusCode, 409, cancel.body);
  const renewal = await app.inject({ method: "POST", url: `/api/v1/contratos/${contractId}/renovacao`, headers: authorized(token), payload: { dataVencimento: new Date(contract.dataVencimento.getTime() + 30 * 86400000).toISOString(), versaoEsperada: contract.versao } });
  assert.equal(renewal.statusCode, 409, renewal.body);
  const contractAfter = await prisma.contrato.findUnique({ where: { id: contractId } });
  assert.ok(contractAfter);
  assert.equal(contractAfter.ativo, true);
  assert.equal(contractAfter.versao, contract.versao + 1);

  const newUserResponse = await app.inject({ method: "POST", url: "/api/v1/usuarios", headers: authorized(token), payload: { usuario: `stale-e2e-${suffix}`, nome: "Usuário de teste de concorrência", senha: "Stale-Version-User-123", papel: "OPERADOR_CADASTRO" } });
  assert.equal(newUserResponse.statusCode, 201, newUserResponse.body);
  const userId = newUserResponse.json().id as string;
  userIds.push(userId);
  const targetUser = await prisma.usuario.findUnique({ where: { id: userId } });
  assert.ok(targetUser);
  const userUpdate = await app.inject({ method: "PATCH", url: `/api/v1/usuarios/${userId}`, headers: authorized(token), payload: { versaoEsperada: targetUser.versao, nome: "Usuário com nova versão" } });
  assert.equal(userUpdate.statusCode, 200, userUpdate.body);
  const staleUserUpdate = await app.inject({ method: "PATCH", url: `/api/v1/usuarios/${userId}`, headers: authorized(token), payload: { versaoEsperada: targetUser.versao, nome: "Nome obsoleto" } });
  assert.equal(staleUserUpdate.statusCode, 409, staleUserUpdate.body);
  const stalePasswordReset = await app.inject({ method: "POST", url: `/api/v1/usuarios/${userId}/redefinicao-senha`, headers: authorized(token), payload: { versaoEsperada: targetUser.versao, novaSenha: "Another-Secure-Password-123" } });
  assert.equal(stalePasswordReset.statusCode, 409, stalePasswordReset.body);
  for (const action of ["desativacao", "reativacao"] as const) {
    const response: InjectResponse = await app.inject({ method: "POST", url: `/api/v1/usuarios/${userId}/${action}`, headers: authorized(token), payload: { versaoEsperada: targetUser.versao } });
    assert.equal(response.statusCode, 409, response.body);
  }
  const targetAfter = await prisma.usuario.findUnique({ where: { id: userId } });
  assert.ok(targetAfter);
  assert.equal(targetAfter.ativo, true);
  assert.equal(targetAfter.versao, targetUser.versao + 1);

  // A atualização normal do usuário incrementa versao sem revogar o JWT;
  // a alteração de senha deve rejeitar a versão antiga antes de tocar no hash.
  const actorBefore = await prisma.usuario.findUnique({ where: { id: actorId } });
  assert.ok(actorBefore);
  const actorUpdate = await app.inject({ method: "PATCH", url: `/api/v1/usuarios/${actorId}`, headers: authorized(token), payload: { versaoEsperada: actorBefore.versao, nome: "Administrador crítico versão atualizada" } });
  assert.equal(actorUpdate.statusCode, 200, actorUpdate.body);
  const passwordChange = await app.inject({ method: "POST", url: "/api/v1/auth/change-password", headers: authorized(token), payload: { senhaAtual: adminPassword, novaSenha: "OutraSenhaSegura123", versaoEsperada: actorBefore.versao } });
  assert.equal(passwordChange.statusCode, 409, passwordChange.body);
  const actorAfter = await prisma.usuario.findUnique({ where: { id: actorId } });
  assert.ok(actorAfter);
  assert.equal(actorAfter.versao, actorBefore.versao + 1);
  assert.equal(actorAfter.authVersion, actorBefore.authVersion);
});

test("atualização dos parâmetros globais rejeita versão obsoleta sem alteração parcial", async () => {
  assert.ok(app);
  const token = await login();
  const beforeResponse = await app.inject({ method: "GET", url: "/api/v1/parametros", headers: authorized(token) });
  assert.equal(beforeResponse.statusCode, 200, beforeResponse.body);
  const before = beforeResponse.json() as { versao: number; aliquotaImpostoPercentual: string | number; taxaDepreciacaoAnualPercentual: string | number };

  const firstUpdate = await app.inject({ method: "PATCH", url: "/api/v1/parametros", headers: authorized(token), payload: { versaoEsperada: before.versao, aliquotaImpostoPercentual: Number(before.aliquotaImpostoPercentual) } });
  assert.equal(firstUpdate.statusCode, 200, firstUpdate.body);
  const staleUpdate = await app.inject({ method: "PATCH", url: "/api/v1/parametros", headers: authorized(token), payload: { versaoEsperada: before.versao, taxaDepreciacaoAnualPercentual: (Number(before.taxaDepreciacaoAnualPercentual) + 1) % 100 } });
  assert.equal(staleUpdate.statusCode, 409, staleUpdate.body);
  assert.equal(staleUpdate.json().error.code, "VERSION_CONFLICT");

  const afterResponse = await app.inject({ method: "GET", url: "/api/v1/parametros", headers: authorized(token) });
  assert.equal(afterResponse.statusCode, 200, afterResponse.body);
  const after = afterResponse.json() as typeof before;
  assert.equal(after.versao, before.versao + 1);
  assert.equal(Number(after.taxaDepreciacaoAnualPercentual), Number(before.taxaDepreciacaoAnualPercentual));
});

test("rotas mutáveis rejeitam versaoEsperada ausente ou inválida no schema HTTP", async () => {
  assert.ok(app);
  const token = await login();
  const id = randomUUID();
  const missingVersionCases = [
    { method: "POST", url: `/api/v1/organizacoes/${id}/desativacao`, payload: {} },
    { method: "POST", url: `/api/v1/organizacoes/${id}/reativacao`, payload: {} },
    { method: "POST", url: `/api/v1/contratos/${id}/renovacao`, payload: { dataVencimento: new Date(Date.now() + 86400000).toISOString() } },
    { method: "POST", url: `/api/v1/contratos/${id}/cancelamento`, payload: {} },
    { method: "POST", url: `/api/v1/lotes/${id}/triagem`, payload: {} },
    ...(["encaminhamento", "finalizacao", "desativacao", "reativacao"] as const).map(action => ({ method: "POST", url: `/api/v1/lotes/${id}/${action}`, payload: {} })),
    { method: "POST", url: `/api/v1/equipamentos/${id}/estado-fisico`, payload: { estadoFisico: "BOM_ESTADO" } },
    { method: "POST", url: `/api/v1/equipamentos/${id}/status-rastreamento`, payload: { statusRastreamento: "EM_TRIAGEM", justificativa: "Teste" } },
    { method: "POST", url: `/api/v1/equipamentos/${id}/desativacao`, payload: {} },
    { method: "POST", url: `/api/v1/equipamentos/${id}/reativacao`, payload: {} },
    { method: "POST", url: `/api/v1/usuarios/${id}/desativacao`, payload: {} },
    { method: "POST", url: `/api/v1/usuarios/${id}/reativacao`, payload: {} },
    { method: "POST", url: `/api/v1/usuarios/${id}/redefinicao-senha`, payload: { novaSenha: "SenhaTesteSegura123" } },
    { method: "PATCH", url: `/api/v1/equipamentos/${id}`, payload: { marca: "Sem versão" } },
    { method: "PATCH", url: `/api/v1/organizacoes/${id}`, payload: {} },
    { method: "PATCH", url: `/api/v1/contratos/${id}`, payload: {} },
    { method: "PATCH", url: `/api/v1/lotes/${id}`, payload: {} },
    { method: "PATCH", url: `/api/v1/usuarios/${id}`, payload: {} },
    { method: "PATCH", url: "/api/v1/parametros", payload: { aliquotaImpostoPercentual: 1 } },
    { method: "POST", url: "/api/v1/auth/change-password", payload: { senhaAtual: "current-password", novaSenha: "NovaSenhaSegura123" } },
  ] as const;
  for (const endpoint of missingVersionCases) {
    const response: InjectResponse = await app.inject({ ...endpoint, headers: authorized(token) });
    assert.equal(response.statusCode, 400, `${endpoint.method} ${endpoint.url}: ${response.body}`);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  }

  const invalid = await app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${id}`, headers: authorized(token), payload: { versaoEsperada: 0, marca: "Versão inválida" } });
  assert.equal(invalid.statusCode, 400, invalid.body);
  assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
  const wrongType = await app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${id}`, headers: authorized(token), payload: { versaoEsperada: "versão", marca: "Tipo inválido" } });
  assert.equal(wrongType.statusCode, 400, wrongType.body);
  assert.equal(wrongType.json().error.code, "VALIDATION_ERROR");
});

test("falha de auditoria reverte a desvinculação sem alterações parciais", async () => {
  assert.ok(app);
  assert.ok(prisma);
  const token = await login();
  const fixture = await createEquipmentScenario(token);
  const before = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
  assert.ok(before);
  const functionName = `test_abort_unlink_${randomUUID().replaceAll("-", "")}`;
  const triggerName = `test_abort_unlink_${randomUUID().replaceAll("-", "")}`;
  let triggerInstalled = false;
  try {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW."acao" = 'DESVINCULACAO_EQUIPAMENTO' AND NEW."entidadeId" = '${fixture.equipmentId}' THEN RAISE EXCEPTION 'controlled unlink rollback'; END IF; RETURN NEW; END; $body$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "eventos_auditoria" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`);
    triggerInstalled = true;
    const response = await app.inject({ method: "PATCH", url: `/api/v1/equipamentos/${fixture.equipmentId}`, headers: authorized(token), payload: { versaoEsperada: before.versao, loteId: null } });
    assert.equal(response.statusCode, 500, response.body);
    assert.equal(response.json().error.code, "INTERNAL_ERROR");
    const after = await prisma.equipamento.findUnique({ where: { id: fixture.equipmentId } });
    assert.ok(after);
    assert.equal(after.loteId, before.loteId);
    assert.equal(after.posicaoNoLote, before.posicaoNoLote);
    assert.equal(after.versao, before.versao);
    assert.equal(await prisma.eventoAuditoria.count({ where: { acao: "DESVINCULACAO_EQUIPAMENTO", entidadeId: fixture.equipmentId } }), 0);
  } finally {
    if (triggerInstalled) await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "eventos_auditoria"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
  }
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
