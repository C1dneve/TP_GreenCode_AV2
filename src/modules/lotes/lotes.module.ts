import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { LotesController } from "./lotes.controller.js";
import { LotesRepository } from "./lotes.repository.js";
import { LotesService } from "./lotes.service.js";
import { registerLoteRoutes } from "./routes.js";
export function registerLotesModule(app: FastifyInstance, prisma: PrismaClient) { registerLoteRoutes(app, new LotesController(new LotesService(new LotesRepository(prisma)))); }
