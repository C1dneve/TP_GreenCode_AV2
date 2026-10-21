export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
}

function requireString(name: string, value: string | undefined): string {
  const result = value?.trim();
  if (!result) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return result;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawPort = env.PORT?.trim() || "3000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT deve ser um inteiro entre 1 e 65535.");
  }

  const databaseUrl = requireString("DATABASE_URL", env.DATABASE_URL);
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("DATABASE_URL deve ser uma URL PostgreSQL válida.");
  }

  const jwtSecret = requireString("JWT_SECRET", env.JWT_SECRET);
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET deve conter no mínimo 32 bytes.");
  }

  return {
    nodeEnv: env.NODE_ENV?.trim() || "development",
    host: env.HOST?.trim() || "127.0.0.1",
    port,
    databaseUrl,
    jwtSecret,
  };
}
