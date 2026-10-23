import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { registerAuthRoutes } from "./routes.js";
export function registerAuthModule(app: FastifyInstance, prisma: PrismaClient): AuthService {
  const service = new AuthService(new AuthRepository(prisma), app.jwt);
  registerAuthRoutes(app, new AuthController(service), service);
  return service;
}
