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

export interface AuditoriaQuery { page: number; pageSize: number; entidade?: string; entidadeId?: string; acao?: string; resultado?: string; de?: Date; ate?: Date }

export class AuditoriaConsultaRepository {
  constructor(private readonly prisma: PrismaClient) {}
  list(input: AuditoriaQuery) {
    const where: Prisma.EventoAuditoriaWhereInput = { ...(input.entidade ? { entidade: input.entidade } : {}), ...(input.entidadeId ? { entidadeId: input.entidadeId } : {}), ...(input.acao ? { acao: input.acao } : {}), ...(input.resultado ? { resultado: input.resultado } : {}), ...(input.de || input.ate ? { instante: { ...(input.de ? { gte: input.de } : {}), ...(input.ate ? { lte: input.ate } : {}) } } : {}) };
    return Promise.all([this.prisma.eventoAuditoria.findMany({ where, orderBy: [{ instante: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.prisma.eventoAuditoria.count({ where })]);
  }
}
