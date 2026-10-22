import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import type { PrismaClient } from "./generated/prisma/client.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerUserRoutes } from "./modules/usuarios/routes.js";

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
        title: "GreenCode API",
        description: "API REST do sistema de logística reversa GreenCode.",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3000" }],
      tags: [{ name: "Health", description: "Estado técnico do serviço" }, { name: "Autenticação", description: "Login e gestão da sessão" }, { name: "Usuários", description: "Gerenciamento administrativo de usuários" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }, schemas: { UsuarioPublico: { type: "object", additionalProperties: false, required: ["id", "usuario", "nome", "papel", "ativo"], properties: { id: { type: "string", format: "uuid" }, usuario: { type: "string" }, nome: { type: "string" }, papel: { type: "string", enum: ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"] }, ativo: { type: "boolean" }, ultimoAcesso: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, versao: { type: "integer" } } }, Erro: { type: "object", required: ["error"], properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, details: {}, requestId: { type: "string" } } } } } } },
    },
  });


  app.setErrorHandler((error: FastifyError, request, reply) => {
    const validationError = Boolean((error as FastifyError & { validation?: unknown }).validation);
    const statusCode = validationError ? 400 : (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500);
    const body: ApiErrorBody = {
      error: {
        code: validationError ? "VALIDATION_ERROR" : statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: validationError
          ? "A requisição contém campos inválidos."
          : statusCode === 500
            ? "Ocorreu um erro interno."
            : error.message,
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
      registerAuthRoutes(instance, options.prisma as PrismaClient);
      registerUserRoutes(instance, options.prisma as PrismaClient);
    });
  }

  app.register(swaggerUi, { routePrefix: "/docs" });

  return app;
}
