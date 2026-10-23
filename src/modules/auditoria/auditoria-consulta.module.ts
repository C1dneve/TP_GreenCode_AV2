import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaConsultaController } from "./auditoria-consulta.controller.js";
import { AuditoriaConsultaService } from "./auditoria-consulta.service.js";
import { AuditoriaConsultaRepository } from "./auditoria.repository.js";
import { registerAuditoriaConsultaRoutes } from "./auditoria-consulta.routes.js";
export function registerAuditoriaConsultaModule(app: FastifyInstance, prisma: PrismaClient) { registerAuditoriaConsultaRoutes(app, new AuditoriaConsultaController(new AuditoriaConsultaService(new AuditoriaConsultaRepository(prisma)))); }
