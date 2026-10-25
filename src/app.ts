import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import type { PrismaClient } from "./generated/prisma/client.js";
import { registerAuthModule } from "./modules/auth/auth.module.js";
import { registerUsuariosModule } from "./modules/usuarios/usuarios.module.js";
import { registerOrganizacoesModule } from "./modules/organizacoes/organizacoes.module.js";
import { registerContratosModule } from "./modules/contratos/contratos.module.js";
import { registerLotesModule } from "./modules/lotes/lotes.module.js";
import { registerEquipamentosModule } from "./modules/equipamentos/equipamentos.module.js";
import { registerMovimentacoesModule } from "./modules/movimentacoes/movimentacoes.module.js";
import { registerAuditoriaConsultaModule } from "./modules/auditoria/auditoria-consulta.module.js";
import { registerRelatoriosModule } from "./modules/relatorios/relatorios.module.js";
import { registerParametrosModule } from "./modules/parametros/parametros.module.js";







import { DomainError } from "./shared/domain-error.js";

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface BuildAppOptions { prisma?: PrismaClient; jwtSecret?: string }

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test" ? { redact: { paths: ["req.headers.authorization", "req.headers.cookie", "req.body.senha", "req.body.senhaAtual", "req.body.novaSenha", "req.body.accessToken", "req.body.password", "req.body.token", "*.senhaHash", "*.JWT_SECRET", "*.DATABASE_URL"], censor: "[REDACTED]" } } : false,
    disableRequestLogging: process.env.NODE_ENV === "test",
    requestIdHeader: "x-request-id",
    genReqId: () => `req-${randomUUID()}`,
  });

  app.register(swagger, {
    openapi: {
      info: {
      title: "GreenCode API do CID",
      description:
        "API REST do sistema de logística reversa GreenCode do CID.\n\n[Ver documento OpenAPI JSON](/docs/json)",
      version: "0.1.0",
    },
      servers: [{ url: "http://localhost:3000" }],
      tags: [{ name: "Health", description: "Estado técnico do serviço" }, { name: "Autenticação", description: "Login e gestão da sessão" }, { name: "Usuários", description: "Gerenciamento administrativo de usuários" }, { name: "Organizações", description: "Cadastro e histórico organizacional" }, { name: "Contratos", description: "Contratos e renovações" }, { name: "Lotes", description: "Ciclo operacional de lotes" }, { name: "Equipamentos", description: "Cadastro e rastreabilidade dos equipamentos" }, { name: "Movimentações", description: "Histórico de movimentações" }, { name: "Auditoria", description: "Trilha de auditoria" }, { name: "Relatórios", description: "Indicadores operacionais" }, { name: "Parâmetros", description: "Parâmetros globais" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }, schemas: { UsuarioPublico: { type: "object", additionalProperties: false, required: ["id", "usuario", "nome", "papel", "ativo"], properties: { id: { type: "string", format: "uuid" }, usuario: { type: "string" }, nome: { type: "string" }, papel: { type: "string", enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] }, ativo: { type: "boolean" }, ultimoAcesso: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, versao: { type: "integer" } } } } },
    },
  });

  // Schemas usados por $ref nas rotas precisam estar registrados no Fastify,
  // não apenas declarados em openapi.components.schemas.
  app.addSchema({
    $id: "Erro",
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: {},
          requestId: { type: "string" },
        },
      },
    },
  });

  app.addSchema({
    $id: "UsuarioPublico",
    type: "object",
    additionalProperties: false,
    required: ["id", "usuario", "nome", "papel", "ativo"],
    properties: {
      id: { type: "string", format: "uuid" },
      usuario: { type: "string" },
      nome: { type: "string" },
      papel: { type: "string", enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] },
      ativo: { type: "boolean" },
      ultimoAcesso: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      versao: { type: "integer" },
    },
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof DomainError) {
      const body: ApiErrorBody = { error: { code: error.code, message: error.message, requestId: request.id } };
      if (error.details !== undefined) body.error.details = error.details;
      if (error.statusCode >= 500) request.log.error({ requestId: request.id, errorName: error.name }, "Falha inesperada na requisição");
      return reply.code(error.statusCode).send(body);
    }
    const validationError = Boolean((error as FastifyError & { validation?: unknown }).validation);
    const prismaCode = (error as FastifyError & { code?: string }).code;
    const mappedPrismaError = {
      P2002: { statusCode: 409, code: "UNIQUE_CONSTRAINT_CONFLICT", message: "A operação conflita com um registro existente." },
      P2003: { statusCode: 409, code: "REFERENTIAL_INTEGRITY_CONFLICT", message: "A operação viola um vínculo entre registros." },
      P2004: { statusCode: 409, code: "DATABASE_CONSTRAINT_CONFLICT", message: "A operação viola uma regra de integridade." },
      P2025: { statusCode: 404, code: "RESOURCE_NOT_FOUND", message: "O registro solicitado não foi encontrado." },
      P2034: { statusCode: 409, code: "CONCURRENT_MODIFICATION", message: "A operação conflitou com uma alteração concorrente." },
    }[prismaCode ?? ""];
    const statusCode = validationError ? 400 : mappedPrismaError?.statusCode ?? (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500);
    const body: ApiErrorBody = {
      error: {
        code: validationError ? "VALIDATION_ERROR" : mappedPrismaError?.code ?? (statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
        message: validationError
          ? "A requisição contém campos inválidos."
          : mappedPrismaError?.message ?? (statusCode === 500 ? "Ocorreu um erro interno." : "A requisição não pôde ser processada."),
        requestId: request.id,
      },
    };
    if (validationError) {
      body.error.details = (error as FastifyError & { validation?: Array<{ instancePath?: string; message?: string }> }).validation?.map((issue) => ({
        field: issue.instancePath || "/",
        reason: issue.message || "invalid",
      }));
    }
    if (statusCode === 500) request.log.error({ requestId: request.id, errorName: error.name, errorCode: error.code }, "Falha inesperada na requisição");
    reply.code(statusCode).send(body);
  });

  app.setNotFoundHandler(async (request, reply) => {
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Recurso não encontrado.",
        requestId: request.id,
      },
    });
  });

  app.register(async (instance: FastifyInstance) => {
    instance.get("/health", {
      schema: {
        tags: ["Health"],
        summary: "Verifica se o servidor HTTP está respondendo.",
        response: {
          200: {
            type: "object",
            required: ["status", "service"],
            properties: {
              status: { type: "string", const: "ok" },
              service: { type: "string", const: "greencode-api" },
            },
          },
        },
      },
    }, async () => ({ status: "ok", service: "greencode-api" }));
  });

  if (options.prisma && options.jwtSecret) {
    app.register(jwt, { secret: options.jwtSecret, sign: { algorithm: "HS256", expiresIn: "30m" }, verify: { algorithms: ["HS256"] } });
    app.register(async (instance) => {
      registerAuthModule(instance, options.prisma as PrismaClient);
      registerUsuariosModule(instance, options.prisma as PrismaClient);
      registerOrganizacoesModule(instance, options.prisma as PrismaClient);
      registerContratosModule(instance, options.prisma as PrismaClient);
      registerLotesModule(instance, options.prisma as PrismaClient);
      registerEquipamentosModule(instance, options.prisma as PrismaClient);
      registerMovimentacoesModule(instance, options.prisma as PrismaClient);
      registerAuditoriaConsultaModule(instance, options.prisma as PrismaClient);
      registerRelatoriosModule(instance, options.prisma as PrismaClient);
      registerParametrosModule(instance, options.prisma as PrismaClient);
    });
  }

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      urls: [
        {
          url: "/docs/json",
          name: "GreenCode API",
        },
      ],
      docExpansion: "list",
      deepLinking: true,
      filter: true,
      displayRequestDuration: true,
    },
    theme: {
      title: "GreenCode API — Documentação interativa",
      css: [{ filename: "greencode-theme.css", content: readFileSync(new URL("./docs/greencode-swagger.css", import.meta.url), "utf8") }],
    },
  });
  return app;
}
