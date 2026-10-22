import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export interface EventoAuditoriaInput {
  atorUsuarioId?: string | null;
  atorNomeSnapshot?: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  resultado: "SUCESSO" | "FALHA" | "NEGADO";
  requestId?: string | null;
  detalhes?: Prisma.InputJsonValue;
}

export type AuditoriaTransaction = Prisma.TransactionClient;

export class AuditoriaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  criar(input: EventoAuditoriaInput, tx: AuditoriaTransaction | PrismaClient = this.prisma) {
    return tx.eventoAuditoria.create({ data: {
      atorUsuarioId: input.atorUsuarioId ?? null,
      atorNomeSnapshot: input.atorNomeSnapshot ?? null,
      acao: input.acao,
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      resultado: input.resultado,
      requestId: input.requestId ?? null,
      detalhes: input.detalhes,
    } });
  }
}
