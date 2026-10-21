import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
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
      tags: [{ name: "Health", description: "Estado técnico do serviço" }],
    },
  });
  app.register(swaggerUi, { routePrefix: "/docs" });

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
    if (statusCode === 500) request.log.error({ err: error }, "Falha inesperada na requisição");
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

  app.get("/health", {
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

  return app;
}
