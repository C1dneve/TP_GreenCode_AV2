import "dotenv/config";
import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createPrismaClient } from "./infrastructure/database/prisma.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = createPrismaClient(config.databaseUrl);
  const app = buildApp({ prisma, jwtSecret: config.jwtSecret });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  let closing = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "Encerramento gracioso iniciado");
    try {
      await app.close();
      process.exitCode = 0;
    } catch (error) {
      app.log.error({ signal, errorName: error instanceof Error ? error.name : "UnknownError" }, "Falha durante encerramento");
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info({ host: config.host, port: config.port }, "GreenCode API iniciada");
  } catch (error) {
    app.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Não foi possível iniciar o servidor");
    await app.close();
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Erro fatal ao inicializar GreenCode API. Revise a configuração e a conectividade; detalhes foram omitidos para proteger segredos.");
  process.exitCode = 1;
});
