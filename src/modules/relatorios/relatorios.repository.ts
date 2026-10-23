import type { PrismaClient } from "../../generated/prisma/client.js";
export class RelatoriosRepository {
  constructor(private readonly prisma: PrismaClient) {}
  lotes(filter: { organizacaoId?: string; de?: Date; ate?: Date; status?: string }) {
    return this.prisma.lote.findMany({ where: { ...(filter.organizacaoId ? { organizacaoId: filter.organizacaoId } : {}), ...(filter.status ? { statusProcessamento: filter.status as never } : {}), ...(filter.de || filter.ate ? { dataEntrada: { ...(filter.de ? { gte: filter.de } : {}), ...(filter.ate ? { lte: filter.ate } : {}) } } : {}) }, select: { id: true, organizacaoId: true, statusProcessamento: true, dataEntrada: true } });
  }
  equipamentos(loteIds: string[]) {
    if (!loteIds.length) return Promise.resolve([]);
    return this.prisma.equipamento.findMany({ where: { loteId: { in: loteIds } } });
  }
  equipamentosFinanceiros() {
    return this.prisma.equipamento.findMany({
      include: { movimentacoes: { take: 1, orderBy: [{ dataHora: "desc" }, { id: "desc" }], select: { dataHora: true } } },
    });
  }
  parametros() { return this.prisma.parametroGlobal.findUnique({ where: { id: "global" } }); }
  contratosNoPeriodo(de: Date, ate: Date) { return this.prisma.contrato.findMany({ where: { dataAssinatura: { lte: ate }, dataVencimento: { gte: de }, OR: [{ dataCancelamento: null }, { dataCancelamento: { gte: de } }] }, select: { id: true, valorMensal: true, ativo: true, dataCancelamento: true, dataAssinatura: true, dataVencimento: true, organizacaoId: true } }); }
}
