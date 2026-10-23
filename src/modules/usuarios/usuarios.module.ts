import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { UsuariosController } from "./usuarios.controller.js";
import { UsuariosRepository } from "./usuarios.repository.js";
import { UsuariosService } from "./usuarios.service.js";
import { registerUserRoutes } from "./routes.js";
export function registerUsuariosModule(app: FastifyInstance, prisma: PrismaClient): void {
  registerUserRoutes(app, new UsuariosController(new UsuariosService(new UsuariosRepository(prisma))));
}
