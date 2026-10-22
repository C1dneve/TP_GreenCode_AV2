import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient, PapelUsuario } from "../../generated/prisma/client.js";
import { AuditoriaService } from "../auditoria/auditoria.service.js";

const publicUserSelect = { id: true, usuario: true, nome: true, papel: true, ativo: true } as const;
type JwtIdentity = { sub: string; papel: PapelUsuario; jti: string; authVersion: number; iat?: number; exp?: number };

declare module "@fastify/jwt" {
  interface FastifyJWT { payload: JwtIdentity; user: JwtIdentity }
}

declare module "fastify" {
  interface FastifyInstance { authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void> }
}

export function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  const audit = new AuditoriaService(prisma);
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify<JwtIdentity>();
    } catch {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Autenticação inválida.", requestId: request.id } });
    }
    const identity = request.user;
    if (!identity.sub || !identity.jti || !Number.isInteger(identity.authVersion) || !identity.exp || !identity.iat) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Autenticação inválida.", requestId: request.id } });
    }
    const [user, revoked] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: identity.sub }, select: { ...publicUserSelect, authVersion: true } }),
      prisma.tokenRevogado.findUnique({ where: { jti: identity.jti }, select: { jti: true } }),
    ]);
    if (!user || !user.ativo || user.authVersion !== identity.authVersion || revoked) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Autenticação inválida.", requestId: request.id } });
    }
    // Always use the current database role; never authorize from the JWT role claim.
    request.user.papel = user.papel;
  });

  app.post("/api/v1/auth/login", { schema: {
    tags: ["Autenticação"], summary: "Autentica usuário e emite JWT válido por 30 minutos", security: [],
    body: { type: "object", additionalProperties: false, required: ["usuario", "senha"], properties: { usuario: { type: "string", minLength: 1, maxLength: 80 }, senha: { type: "string", minLength: 1, maxLength: 200 } } },
    response: { 200: { type: "object", required: ["accessToken", "tokenType", "expiresIn", "usuario"], properties: { accessToken: { type: "string" }, tokenType: { type: "string", const: "Bearer" }, expiresIn: { type: "integer", const: 1800 }, usuario: { $ref: "#/components/schemas/UsuarioPublico" } } }, 401: { $ref: "#/components/schemas/Erro" } }
  } }, async (request, reply) => {
    const body = request.body as { usuario: string; senha: string };
    const username = body.usuario.trim().toLocaleLowerCase("pt-BR");
    const user = await prisma.usuario.findUnique({ where: { usuario: username } });
    const valid = user ? await bcrypt.compare(body.senha, user.senhaHash) : await bcrypt.compare(body.senha, "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy").catch(() => false);
    if (!user || !valid || !user.ativo) {
      await audit.registrar({ atorUsuarioId: user?.id ?? null, atorNomeSnapshot: user?.nome ?? null, acao: "LOGIN", entidade: "Usuario", entidadeId: user?.id ?? username.slice(0, 80), resultado: "FALHA", requestId: request.id });
      return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "Usuário ou senha inválidos.", requestId: request.id } });
    }
    const updated = await prisma.usuario.update({ where: { id: user.id }, data: { ultimoAcesso: new Date() }, select: { ...publicUserSelect, authVersion: true } });
    const accessToken = app.jwt.sign({ sub: updated.id, papel: updated.papel, jti: randomUUID(), authVersion: updated.authVersion }, { expiresIn: "30m", algorithm: "HS256" });
    await audit.registrar({ atorUsuarioId: user.id, atorNomeSnapshot: user.nome, acao: "LOGIN", entidade: "Usuario", entidadeId: user.id, resultado: "SUCESSO", requestId: request.id });
    return reply.send({ accessToken, tokenType: "Bearer", expiresIn: 1800, usuario: { id: updated.id, usuario: updated.usuario, nome: updated.nome, papel: updated.papel, ativo: updated.ativo } });
  });

  app.get("/api/v1/auth/me", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Retorna o usuário autenticado", security: [{ bearerAuth: [] }], response: { 200: { $ref: "#/components/schemas/UsuarioPublico" } } } }, async (request) => {
    const user = await prisma.usuario.findUnique({ where: { id: request.user.sub }, select: publicUserSelect });
    return user;
  });

  app.post("/api/v1/auth/logout", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Revoga o token atual", security: [{ bearerAuth: [] }], response: { 204: { type: "null" } } } }, async (request, reply) => {
    const identity = request.user;
    const expiresAt = new Date((identity.exp as number) * 1000);
    await prisma.tokenRevogado.upsert({ where: { jti: identity.jti }, update: {}, create: { jti: identity.jti, usuarioId: identity.sub, expiraEm: expiresAt } });
    await audit.registrar({ atorUsuarioId: identity.sub, acao: "LOGOUT", entidade: "Usuario", entidadeId: identity.sub, resultado: "SUCESSO", requestId: request.id });
    return reply.code(204).send();
  });

  app.post("/api/v1/auth/change-password", { preHandler: app.authenticate, schema: { tags: ["Autenticação"], summary: "Altera a senha e invalida todas as sessões", security: [{ bearerAuth: [] }], body: { type: "object", additionalProperties: false, required: ["senhaAtual", "novaSenha"], properties: { senhaAtual: { type: "string", minLength: 1, maxLength: 200 }, novaSenha: { type: "string", minLength: 12, maxLength: 200 } } }, response: { 204: { type: "null" } } } }, async (request, reply) => {
    const body = request.body as { senhaAtual: string; novaSenha: string };
    const user = await prisma.usuario.findUnique({ where: { id: request.user.sub } });
    if (!user || !(await bcrypt.compare(body.senhaAtual, user.senhaHash))) return reply.code(400).send({ error: { code: "INVALID_CURRENT_PASSWORD", message: "A senha atual é inválida.", requestId: request.id } });
    if (body.novaSenha.length < 12) return reply.code(400).send({ error: { code: "PASSWORD_POLICY_VIOLATION", message: "A nova senha deve ter pelo menos 12 caracteres.", requestId: request.id } });
    const hash = await bcrypt.hash(body.novaSenha, 12);
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: user.id }, data: { senhaHash: hash, authVersion: { increment: 1 }, versao: { increment: 1 } } });
      await audit.registrar({ atorUsuarioId: user.id, atorNomeSnapshot: user.nome, acao: "ALTERACAO_SENHA", entidade: "Usuario", entidadeId: user.id, resultado: "SUCESSO", requestId: request.id }, tx);
    });
    return reply.code(204).send();
  });
}
