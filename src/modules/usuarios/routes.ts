import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Prisma, PrismaClient, PapelUsuario } from "../../generated/prisma/client.js";
import { AuditoriaService } from "../auditoria/auditoria.service.js";

const selectPublic = { id: true, usuario: true, nome: true, papel: true, ativo: true, ultimoAcesso: true, createdAt: true, updatedAt: true, versao: true } as const;
const roles = ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] as const;
const uuid = { type: "string", format: "uuid" } as const;
const errorRef = { $ref: "#/components/schemas/Erro" } as const;

function fail(reply: FastifyReply, request: FastifyRequest, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message, requestId: request.id } });
}
function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (request.user.papel !== "ADMINISTRADOR") { void fail(reply, request, 403, "FORBIDDEN", "Permissão insuficiente."); return false; }
  return true;
}

export function registerUserRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  const audit = new AuditoriaService(prisma);
  const admin = { preHandler: [app.authenticate, async (request: FastifyRequest, reply: FastifyReply) => { if (!requireAdmin(request, reply)) return reply; }] };

  app.get("/api/v1/usuarios", { ...admin, schema: { tags: ["Usuários"], summary: "Lista usuários (Administrador)", security: [{ bearerAuth: [] }], querystring: { type: "object", additionalProperties: false, properties: { page: { type: "integer", minimum: 1, default: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 }, busca: { type: "string", maxLength: 120 }, papel: { type: "string", enum: [...roles] }, ativo: { type: "boolean" } } } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const q = request.query as { page?: number; pageSize?: number; busca?: string; papel?: PapelUsuario; ativo?: boolean };
    const page = q.page ?? 1; const pageSize = q.pageSize ?? 20;
    const where: Prisma.UsuarioWhereInput = { ...(q.papel ? { papel: q.papel } : {}), ...(q.ativo === undefined ? {} : { ativo: q.ativo }), ...(q.busca ? { OR: [{ usuario: { contains: q.busca.trim().toLowerCase() } }, { nome: { contains: q.busca.trim(), mode: "insensitive" } }] } : {}) };
    const [data, total] = await Promise.all([prisma.usuario.findMany({ where, select: selectPublic, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }), prisma.usuario.count({ where })]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  app.post("/api/v1/usuarios", { ...admin, schema: { tags: ["Usuários"], summary: "Cria usuário (Administrador)", security: [{ bearerAuth: [] }], body: { type: "object", additionalProperties: false, required: ["usuario", "nome", "senha", "papel"], properties: { usuario: { type: "string", minLength: 1, maxLength: 80 }, nome: { type: "string", minLength: 1, maxLength: 120 }, senha: { type: "string", minLength: 12, maxLength: 200 }, papel: { type: "string", enum: [...roles] } } }, response: { 201: { $ref: "#/components/schemas/UsuarioPublico" }, 400: errorRef, 409: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const body = request.body as { usuario: string; nome: string; senha: string; papel: PapelUsuario };
    const username = body.usuario.trim().toLowerCase(); const nome = body.nome.trim();
    if (!username || !nome || body.senha.length < 12) return fail(reply, request, 400, "VALIDATION_ERROR", "Dados do usuário inválidos.");
    const hash = await bcrypt.hash(body.senha, 12);
    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.usuario.create({ data: { usuario: username, nome, senhaHash: hash, papel: body.papel }, select: selectPublic });
        await audit.registrar({ atorUsuarioId: request.user.sub, atorNomeSnapshot: (await tx.usuario.findUnique({ where: { id: request.user.sub }, select: { nome: true } }))?.nome, acao: "CRIACAO_USUARIO", entidade: "Usuario", entidadeId: created.id, resultado: "SUCESSO", requestId: request.id }, tx);
        return created;
      });
      return reply.code(201).header("Location", `/api/v1/usuarios/${user.id}`).send(user);
    } catch (error) {
      if (isUniqueError(error)) return fail(reply, request, 409, "USER_ALREADY_EXISTS", "Já existe um usuário com esse identificador.");
      throw error;
    }
  });

  app.get("/api/v1/usuarios/:usuarioId", { ...admin, schema: { tags: ["Usuários"], summary: "Consulta usuário", security: [{ bearerAuth: [] }], params: { type: "object", required: ["usuarioId"], properties: { usuarioId: uuid } }, response: { 200: { $ref: "#/components/schemas/UsuarioPublico" }, 404: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { usuarioId } = request.params as { usuarioId: string };
    const user = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: selectPublic });
    return user ?? fail(reply, request, 404, "USER_NOT_FOUND", "Usuário não encontrado.");
  });

  app.patch("/api/v1/usuarios/:usuarioId", { ...admin, schema: { tags: ["Usuários"], summary: "Atualiza campos permitidos", security: [{ bearerAuth: [] }], params: { type: "object", required: ["usuarioId"], properties: { usuarioId: uuid } }, body: { type: "object", additionalProperties: false, required: ["versaoEsperada"], properties: { versaoEsperada: { type: "integer", minimum: 1 }, usuario: { type: "string", minLength: 1, maxLength: 80 }, nome: { type: "string", minLength: 1, maxLength: 120 }, papel: { type: "string", enum: [...roles] } } }, response: { 200: { $ref: "#/components/schemas/UsuarioPublico" }, 400: errorRef, 404: errorRef, 409: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { usuarioId } = request.params as { usuarioId: string };
    const body = request.body as { versaoEsperada: number; usuario?: string; nome?: string; papel?: PapelUsuario };
    if ((body.usuario !== undefined && !body.usuario.trim()) || (body.nome !== undefined && !body.nome.trim())) return fail(reply, request, 400, "VALIDATION_ERROR", "Usuário e nome não podem ficar vazios.");
    if (body.usuario === undefined && body.nome === undefined && body.papel === undefined) return fail(reply, request, 400, "VALIDATION_ERROR", "Informe ao menos um campo para atualização.");
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.usuario.findUnique({ where: { id: usuarioId } });
        if (!current) return fail(reply, request, 404, "USER_NOT_FOUND", "Usuário não encontrado.");
        if (current.versao !== body.versaoEsperada) return fail(reply, request, 409, "VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        if (current.ativo && current.papel === "ADMINISTRADOR" && body.papel !== undefined && body.papel !== "ADMINISTRADOR") {
          const count = await tx.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR" } });
          if (count <= 1) return fail(reply, request, 409, "LAST_ADMINISTRATOR", "Não é permitido remover o último Administrador ativo.");
        }
        const data: Prisma.UsuarioUpdateManyMutationInput = { versao: { increment: 1 } };
        if (body.usuario !== undefined) data.usuario = body.usuario.trim().toLowerCase();
        if (body.nome !== undefined) data.nome = body.nome.trim();
        if (body.papel !== undefined) data.papel = body.papel;
        const changed = await tx.usuario.updateMany({ where: { id: usuarioId, versao: body.versaoEsperada }, data });
        if (changed.count !== 1) return fail(reply, request, 409, "VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        const updated = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: selectPublic });
        await audit.registrar({ atorUsuarioId: request.user.sub, acao: "ATUALIZACAO_USUARIO", entidade: "Usuario", entidadeId: usuarioId, resultado: "SUCESSO", requestId: request.id }, tx);
        return updated;
      }, { isolationLevel: "Serializable" });
    } catch (error) { if (isUniqueError(error)) return fail(reply, request, 409, "USER_ALREADY_EXISTS", "Já existe um usuário com esse identificador."); throw error; }
  });

  app.post("/api/v1/usuarios/:usuarioId/desativacao", { ...admin, schema: { tags: ["Usuários"], summary: "Desativa usuário", security: [{ bearerAuth: [] }], params: { type: "object", required: ["usuarioId"], properties: { usuarioId: uuid } }, response: { 204: { type: "null" }, 400: errorRef, 404: errorRef, 409: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { usuarioId } = request.params as { usuarioId: string };
    if (usuarioId === request.user.sub) return fail(reply, request, 409, "SELF_DEACTIVATION_FORBIDDEN", "Não é permitido desativar a própria conta.");
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.usuario.findUnique({ where: { id: usuarioId } });
      if (!target) return "NOT_FOUND" as const;
      if (!target.ativo) return "OK" as const;
      if (target.papel === "ADMINISTRADOR") {
        const count = await tx.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR" } });
        if (count <= 1) return "LAST_ADMIN" as const;
      }
      await tx.usuario.update({ where: { id: usuarioId }, data: { ativo: false, versao: { increment: 1 }, authVersion: { increment: 1 } } });
      await audit.registrar({ atorUsuarioId: request.user.sub, acao: "DESATIVACAO_USUARIO", entidade: "Usuario", entidadeId: usuarioId, resultado: "SUCESSO", requestId: request.id }, tx);
      return "OK" as const;
    }, { isolationLevel: "Serializable" });
    if (result === "NOT_FOUND") return fail(reply, request, 404, "USER_NOT_FOUND", "Usuário não encontrado.");
    if (result === "LAST_ADMIN") return fail(reply, request, 409, "LAST_ADMINISTRATOR", "Não é permitido desativar o último Administrador ativo.");
    return reply.code(204).send();
  });

  app.post("/api/v1/usuarios/:usuarioId/reativacao", { ...admin, schema: { tags: ["Usuários"], summary: "Reativa usuário", security: [{ bearerAuth: [] }], params: { type: "object", required: ["usuarioId"], properties: { usuarioId: uuid } }, response: { 204: { type: "null" }, 404: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { usuarioId } = request.params as { usuarioId: string };
    const user = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!user) return fail(reply, request, 404, "USER_NOT_FOUND", "Usuário não encontrado.");
    if (user.ativo) return reply.code(204).send();
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuarioId }, data: { ativo: true, versao: { increment: 1 }, authVersion: { increment: 1 } } });
      await audit.registrar({ atorUsuarioId: request.user.sub, acao: "REATIVACAO_USUARIO", entidade: "Usuario", entidadeId: usuarioId, resultado: "SUCESSO", requestId: request.id }, tx);
    });
    return reply.code(204).send();
  });

  app.post("/api/v1/usuarios/:usuarioId/redefinicao-senha", { ...admin, schema: { tags: ["Usuários"], summary: "Redefine senha administrativamente", security: [{ bearerAuth: [] }], params: { type: "object", required: ["usuarioId"], properties: { usuarioId: uuid } }, body: { type: "object", additionalProperties: false, required: ["novaSenha"], properties: { novaSenha: { type: "string", minLength: 12, maxLength: 200 } } }, response: { 204: { type: "null" }, 404: errorRef } } }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { usuarioId } = request.params as { usuarioId: string };
    const { novaSenha } = request.body as { novaSenha: string };
    const target = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, nome: true } });
    if (!target) return fail(reply, request, 404, "USER_NOT_FOUND", "Usuário não encontrado.");
    const senhaHash = await bcrypt.hash(novaSenha, 12);
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuarioId }, data: { senhaHash, authVersion: { increment: 1 }, versao: { increment: 1 } } });
      await audit.registrar({ atorUsuarioId: request.user.sub, acao: "REDEFINICAO_SENHA", entidade: "Usuario", entidadeId: usuarioId, resultado: "SUCESSO", requestId: request.id }, tx);
    });
    return reply.code(204).send();
  });
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
