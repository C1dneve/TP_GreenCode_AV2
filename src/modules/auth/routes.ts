import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PapelUsuario } from "../../generated/prisma/client.js";
import { DomainError } from "../../shared/domain-error.js";
import type { AuthController } from "./auth.controller.js";
import type { AuthService, JwtIdentity } from "./auth.service.js";

declare module "@fastify/jwt" { interface FastifyJWT { payload: JwtIdentity; user: JwtIdentity } }
declare module "fastify" { interface FastifyInstance { authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void> } }
const userPublic = { type: "object", additionalProperties: false, required: ["id", "usuario", "nome", "papel", "ativo"], properties: { id: { type: "string", format: "uuid" }, usuario: { type: "string" }, nome: { type: "string" }, papel: { type: "string", enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] }, ativo: { type: "boolean" }, ultimoAcesso: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, versao: { type: "integer" } } } as const;
const errorRef = { $ref: "Erro#" } as const;

export function registerAuthRoutes(app: FastifyInstance, controller: AuthController, service: AuthService): void {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try { await request.jwtVerify<JwtIdentity>(); }
    catch { return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Autenticação inválida.", requestId: request.id } }); }
    try {
      const current = await service.validateIdentity(request.user);
      request.user.papel = current.papel as PapelUsuario;
    } catch (error) {
      if (error instanceof DomainError && error.statusCode === 401) return reply.code(401).send({ error: { code: error.code, message: error.message, requestId: request.id } });
      throw error;
    }
  });

  app.post("/api/v1/auth/login", { schema: { tags: ["Autenticação"], summary: "Autentica usuário e emite JWT válido por 30 minutos", security: [], body: { type: "object", additionalProperties: false, required: ["usuario", "senha"], properties: { usuario: { type: "string", minLength: 1, maxLength: 80 }, senha: { type: "string", minLength: 1, maxLength: 200 } } }, response: { 200: { type: "object", required: ["accessToken", "tokenType", "expiresIn", "usuario"], properties: { accessToken: { type: "string" }, tokenType: { type: "string", const: "Bearer" }, expiresIn: { type: "integer", const: 1800 }, usuario: userPublic } }, 401: errorRef } } }, async (request) => controller.login(request.body as { usuario: string; senha: string }, request.id));
  app.get("/api/v1/auth/me", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Retorna o usuário autenticado", security: [{ bearerAuth: [] }], response: { 200: userPublic, 401: errorRef } } }, async (request) => controller.me(request.user));
  app.post("/api/v1/auth/logout", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Revoga o token atual", security: [{ bearerAuth: [] }], response: { 204: { type: "null" }, 401: errorRef } } }, async (request, reply) => { await controller.logout(request.user, request.id); return reply.code(204).send(); });
  app.post("/api/v1/auth/change-password", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Altera a senha e invalida todas as sessões", security: [{ bearerAuth: [] }], body: { type: "object", additionalProperties: false, required: ["senhaAtual", "novaSenha"], properties: { senhaAtual: { type: "string", minLength: 1, maxLength: 200 }, novaSenha: { type: "string", minLength: 12, maxLength: 200 } } }, response: { 204: { type: "null" }, 400: errorRef } } }, async (request, reply) => { await controller.changePassword(request.user, request.body as { senhaAtual: string; novaSenha: string }, request.id); return reply.code(204).send(); });
}
