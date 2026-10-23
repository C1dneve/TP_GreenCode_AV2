import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { MovimentacoesController } from "./movimentacoes.controller.js";
import { MovimentacoesRepository } from "./movimentacoes.repository.js";
import { MovimentacoesService } from "./movimentacoes.service.js";
import { registerMovimentacaoRoutes } from "./routes.js";
export function registerMovimentacoesModule(app: FastifyInstance, prisma: PrismaClient) { registerMovimentacaoRoutes(app, new MovimentacoesController(new MovimentacoesService(new MovimentacoesRepository(prisma)))); }
