import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class EquipamentosRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(cb: (repo: EquipamentosRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => cb(new EquipamentosRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  recordAudit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  findLot(id: string) { return this.db.lote.findUnique({ where: { id }, select: { id: true, ativo: true, statusProcessamento: true } }); }
  nextPosition(loteId: string) { return this.db.equipamento.aggregate({ where: { loteId }, _max: { posicaoNoLote: true } }).then(x => (x._max.posicaoNoLote ?? 0) + 1); }
  findById(id: string) { return this.db.equipamento.findUnique({ where: { id }, include: { lote: { select: { id: true, notaFiscal: true, statusProcessamento: true } }, _count: { select: { movimentacoes: true } } } }); }
  list(input: { page: number; pageSize: number; q?: string; loteId?: string; tipo?: string; estadoFisico?: string; statusRastreamento?: string; ativo?: boolean }) {
    const where: Prisma.EquipamentoWhereInput = { ...(input.loteId ? { loteId: input.loteId } : {}), ...(input.tipo ? { tipo: input.tipo as never } : {}), ...(input.estadoFisico ? { estadoFisico: input.estadoFisico as never } : {}), ...(input.statusRastreamento ? { statusRastreamento: input.statusRastreamento as never } : {}), ...(input.ativo === undefined ? {} : { ativo: input.ativo }), ...(input.q ? { OR: [{ codigoBarrasInterno: { contains: input.q.trim(), mode: "insensitive" } }, { marca: { contains: input.q.trim(), mode: "insensitive" } }, { modelo: { contains: input.q.trim(), mode: "insensitive" } }] } : {}) };
    return Promise.all([this.db.equipamento.findMany({ where, include: { lote: { select: { id: true, notaFiscal: true, statusProcessamento: true } }, _count: { select: { movimentacoes: true } } }, orderBy: [{ codigoBarrasInterno: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.db.equipamento.count({ where })]);
  }
  create(data: Prisma.EquipamentoUncheckedCreateInput) { return this.db.equipamento.create({ data, include: { lote: { select: { id: true, notaFiscal: true, statusProcessamento: true } }, _count: { select: { movimentacoes: true } } } }); }
  updateVersioned(id: string, version: number, data: Prisma.EquipamentoUncheckedUpdateManyInput) { return this.db.equipamento.updateMany({ where: { id, versao: version }, data }).then(r => r.count === 1 ? this.findById(id) : null); }
  actorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
}
