import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import type { PrismaClient, PapelUsuario } from "../generated/prisma/client.js";
import { buildApp } from "../app.js";

const secret = "test-only-jwt-secret-that-is-long-enough-123456";
const roles: PapelUsuario[] = ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"];
const password = "CorrectHorseBattery12";
const hash = await bcrypt.hash(password, 4);
const users = roles.map((papel, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  usuario: papel.toLowerCase(), nome: `Teste ${papel}`, senhaHash: hash, papel, ativo: true,
  authVersion: 1, versao: 1, ultimoAcesso: null, createdAt: new Date(), updatedAt: new Date(),
}));
const fakePrisma = {
  usuario: {
    findUnique: async ({ where }: { where: { usuario?: string; id?: string } }) => users.find((u) => where.usuario ? u.usuario === where.usuario : u.id === where.id) ?? null,
    update: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id)!,
    findMany: async () => users.map(({ senhaHash: _hash, authVersion: _auth, ...u }) => u),
    count: async () => users.length,
  },
  tokenRevogado: { findUnique: async () => null, upsert: async () => ({}) },
  eventoAuditoria: { create: async () => ({ id: "audit-test" }) },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakePrisma),
} as unknown as PrismaClient;

const previousEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";
const app = buildApp({ prisma: fakePrisma, jwtSecret: secret });
before(async () => { await app.ready(); });
after(async () => { await app.close(); if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv; });

async function login(role: PapelUsuario): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { usuario: role.toLowerCase(), senha: password } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().expiresIn, 1800);
  assert.equal(response.json().tokenType, "Bearer");
  assert.equal("senhaHash" in response.json().usuario, false);
  return response.json().accessToken as string;
}

test("login emite JWT com validade contratual e resposta pública sem hash", async () => {
  const token = await login("ADMINISTRADOR");
  assert.ok(token.split(".").length === 3);
});

test("credenciais inexistentes e incorretas retornam o mesmo erro público", async () => {
  const wrongPassword = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { usuario: "administrador", senha: "incorrect-password" } });
  const missingUser = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { usuario: "nao-existe", senha: "incorrect-password" } });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(missingUser.statusCode, 401);
  assert.equal(wrongPassword.json().error.code, missingUser.json().error.code);
  assert.equal(wrongPassword.json().error.message, missingUser.json().error.message);
});

test("os quatro papéis acessam /auth/me, mas somente Administrador lista usuários", async () => {
  for (const role of roles) {
    const token = await login(role);
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: `Bearer ${token}` } });
    assert.equal(me.statusCode, 200, `${role} deve acessar /auth/me`);
    const list = await app.inject({ method: "GET", url: "/api/v1/usuarios", headers: { authorization: `Bearer ${token}` } });
    assert.equal(list.statusCode, role === "ADMINISTRADOR" ? 200 : 403, `${role} RBAC`);
  }
});

test("rotas protegidas negam token ausente e token malformado", async () => {
  const missing = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
  const malformed = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: "Bearer not-a-jwt" } });
  assert.equal(missing.statusCode, 401);
  assert.equal(malformed.statusCode, 401);
});

test("todos os endpoints administrativos negam os três papéis não administradores", async () => {
  const endpoints = [
    { method: "GET", url: "/api/v1/usuarios" },
    { method: "POST", url: "/api/v1/usuarios", payload: { usuario: "novo", nome: "Novo", senha: password, papel: "AUDITOR" } },
    { method: "GET", url: `/api/v1/usuarios/${users[0]!.id}` },
    { method: "PATCH", url: `/api/v1/usuarios/${users[0]!.id}`, payload: { versaoEsperada: 1, nome: "Alterado" } },
    { method: "POST", url: `/api/v1/usuarios/${users[0]!.id}/desativacao`, payload: { versaoEsperada: 1 } },
    { method: "POST", url: `/api/v1/usuarios/${users[0]!.id}/reativacao`, payload: { versaoEsperada: 1 } },
    { method: "POST", url: `/api/v1/usuarios/${users[0]!.id}/redefinicao-senha`, payload: { novaSenha: "NewSecurePassword12", versaoEsperada: 1 } },
  ] as const;
  for (const role of roles.filter((candidate) => candidate !== "ADMINISTRADOR")) {
    const token = await login(role);
    for (const endpoint of endpoints) {
      const response = await app.inject({ ...endpoint, headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.statusCode, 403, `${role} ${endpoint.method} ${endpoint.url}`);
    }
  }
});
