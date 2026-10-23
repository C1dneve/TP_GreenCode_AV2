import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { RelatoriosController } from "./relatorios.controller.js";
import { RelatoriosRepository } from "./relatorios.repository.js";
import { RelatoriosService } from "./relatorios.service.js";
import { registerRelatoriosRoutes } from "./routes.js";
export function registerRelatoriosModule(app: FastifyInstance, prisma: PrismaClient) { registerRelatoriosRoutes(app, new RelatoriosController(new RelatoriosService(new RelatoriosRepository(prisma)))); }
