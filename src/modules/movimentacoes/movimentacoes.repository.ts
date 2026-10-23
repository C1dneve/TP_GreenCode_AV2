import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class MovimentacoesRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(cb: (repo: MovimentacoesRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => cb(new MovimentacoesRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  recordAudit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  findEquipment(id: string) { return this.db.equipamento.findUnique({ where: { id }, include: { lote: { select: { id: true, notaFiscal: true } } } }); }
  findActor(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true } }); }
  latestForEquipment(id: string) { return this.db.movimentacao.findFirst({ where: { equipamentoId: id }, orderBy: [{ dataHora: "desc" }, { id: "desc" }] }); }
  create(data: Prisma.MovimentacaoUncheckedCreateInput) { return this.db.movimentacao.create({ data, include: { equipamento: { select: { id: true, codigoBarrasInterno: true } }, responsavel: { select: { id: true } } } }); }
  list(input: { page: number; pageSize: number; equipamentoId?: string; responsavelId?: string; de?: Date; ate?: Date }) {
    const where: Prisma.MovimentacaoWhereInput = { ...(input.equipamentoId ? { equipamentoId: input.equipamentoId } : {}), ...(input.responsavelId ? { responsavelId: input.responsavelId } : {}), ...(input.de || input.ate ? { dataHora: { ...(input.de ? { gte: input.de } : {}), ...(input.ate ? { lte: input.ate } : {}) } } : {}) };
    return Promise.all([this.db.movimentacao.findMany({ where, orderBy: [{ dataHora: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.db.movimentacao.count({ where })]);
  }
  findById(id: string) { return this.db.movimentacao.findUnique({ where: { id } }); }
  listForEquipment(id: string, page: number, pageSize: number) { return this.list({ page, pageSize, equipamentoId: id }); }
}
