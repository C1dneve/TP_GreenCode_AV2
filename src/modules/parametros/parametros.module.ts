import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { ParametrosController } from "./parametros.controller.js";
import { ParametrosRepository } from "./parametros.repository.js";
import { ParametrosService } from "./parametros.service.js";
import { registerParametrosRoutes } from "./routes.js";
export function registerParametrosModule(app: FastifyInstance, prisma: PrismaClient) { registerParametrosRoutes(app, new ParametrosController(new ParametrosService(new ParametrosRepository(prisma)))); }
