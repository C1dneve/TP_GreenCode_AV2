import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL precisa estar definida para executar o seed.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  await prisma.parametroGlobal.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", aliquotaImpostoPercentual: "0.00", taxaDepreciacaoAnualPercentual: "15.00" },
  });

  const usuario = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const nome = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const senha = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const informouAlgumaCredencial = Boolean(usuario || nome || senha);

  if (informouAlgumaCredencial) {
    if (!usuario || !nome || !senha) {
      throw new Error("Para provisionar o Administrador, informe BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME e BOOTSTRAP_ADMIN_PASSWORD.");
    }
    if (senha.length < 12) throw new Error("A senha inicial do Administrador precisa ter pelo menos 12 caracteres.");
    const senhaHash = await bcrypt.hash(senha, 12);
    await prisma.usuario.upsert({
      where: { usuario },
      update: {},
      create: { usuario, nome, senhaHash, papel: "ADMINISTRADOR", ativo: true },
    });
    console.info(`Administrador de desenvolvimento verificado/criado: ${usuario}`);
  } else {
    console.info("Parâmetros globais verificados. Nenhum administrador foi criado; configure explicitamente as variáveis BOOTSTRAP_ADMIN_* para provisioná-lo.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao executar seed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
