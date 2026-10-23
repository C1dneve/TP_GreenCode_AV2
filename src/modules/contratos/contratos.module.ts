import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { ContratosController } from "./contratos.controller.js";
import { ContratosRepository } from "./contratos.repository.js";
import { ContratosService } from "./contratos.service.js";
import { registerContratoRoutes } from "./routes.js";
export function registerContratosModule(app: FastifyInstance, prisma: PrismaClient) { registerContratoRoutes(app, new ContratosController(new ContratosService(new ContratosRepository(prisma)))); }
