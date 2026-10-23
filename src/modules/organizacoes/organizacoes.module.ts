import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { OrganizacoesController } from "./organizacoes.controller.js";
import { OrganizacoesRepository } from "./organizacoes.repository.js";
import { OrganizacoesService } from "./organizacoes.service.js";
import { registerOrganizacaoRoutes } from "./routes.js";
export function registerOrganizacoesModule(app: FastifyInstance, prisma: PrismaClient) { registerOrganizacaoRoutes(app, new OrganizacoesController(new OrganizacoesService(new OrganizacoesRepository(prisma)))); }
