import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository, type AuditoriaTransaction, type EventoAuditoriaInput } from "./auditoria.repository.js";

export class AuditoriaService {
  private readonly repository: AuditoriaRepository;
  constructor(prisma: PrismaClient) { this.repository = new AuditoriaRepository(prisma); }
  registrar(input: EventoAuditoriaInput, tx?: AuditoriaTransaction | PrismaClient) {
    return this.repository.criar(input, tx);
  }
  detalhesSeguros(value: Record<string, string | number | boolean | null | undefined>): Prisma.InputJsonObject {
    const safe: Record<string, string | number | boolean | null> = {};
    for (const [key, val] of Object.entries(value)) {
      if (/senha|hash|token|secret|authorization|credential/i.test(key)) continue;
      if (val === undefined) continue;
      safe[key] = val;
    }
    return safe;
  }
}
