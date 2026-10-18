import 'dotenv/config';
import { buildApp } from './app.js';

function readPort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }
  return port;
}

const app = buildApp();
const port = readPort(process.env.PORT);
const host = process.env.HOST ?? '127.0.0.1';
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Encerrando servidor de forma graciosa.');
  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, 'Falha durante o encerramento.');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error({ err: error }, 'NÃ£o foi possÃ­vel iniciar o servidor.');
  process.exitCode = 1;
}
