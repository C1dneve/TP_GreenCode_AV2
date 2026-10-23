import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { EquipamentosController } from "./equipamentos.controller.js";
import { EquipamentosRepository } from "./equipamentos.repository.js";
import { EquipamentosService } from "./equipamentos.service.js";
import { registerEquipamentoRoutes } from "./routes.js";
export function registerEquipamentosModule(app: FastifyInstance, prisma: PrismaClient) { registerEquipamentoRoutes(app, new EquipamentosController(new EquipamentosService(new EquipamentosRepository(prisma)))); }
