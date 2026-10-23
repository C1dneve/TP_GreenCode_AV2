import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { getBootstrapAdminConfig } from "../src/config/bootstrap-admin.js";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL precisa estar definida para executar o seed.");
  }

  // Validate bootstrap configuration before writing even the global parameters.
  const bootstrapAdmin = getBootstrapAdminConfig();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await prisma.parametroGlobal.upsert({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        aliquotaImpostoPercentual: "0.00",
        taxaDepreciacaoAnualPercentual: "15.00",
      },
    });

    if (bootstrapAdmin) {
      const senhaHash = await bcrypt.hash(bootstrapAdmin.senha, 12);
      await prisma.usuario.upsert({
        where: { usuario: bootstrapAdmin.usuario },
        // Deliberately empty: rerunning seed never changes an existing password.
        update: {},
        create: {
          usuario: bootstrapAdmin.usuario,
          nome: bootstrapAdmin.nome,
          senhaHash,
          papel: "ADMINISTRADOR",
          ativo: true,
        },
      });
      console.info("Bootstrap do Administrador concluído; credenciais existentes foram preservadas.");
    } else {
      console.info(
        "Parâmetros globais verificados. Nenhum Administrador foi criado; configure as três variáveis BOOTSTRAP_ADMIN_* explicitamente para provisioná-lo.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const safeConfigurationError = /^(DATABASE_URL precisa estar definida|Configuração incompleta: informe BOOTSTRAP_ADMIN_USERNAME|BOOTSTRAP_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres)/.test(message);
  if (safeConfigurationError) {
    console.error("Falha ao executar seed:", message);
  } else {
    // Driver/ORM errors can contain query arguments or connection details; do not print them.
    console.error("Falha ao executar seed. Revise a configuração do banco e a conectividade; detalhes foram omitidos para proteger credenciais e dados.");
  }
  process.exitCode = 1;
});
