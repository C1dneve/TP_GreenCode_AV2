import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class LotesRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(cb: (repo: LotesRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => cb(new LotesRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  recordAudit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  findOrganization(id: string) { return this.db.organizacao.findUnique({ where: { id }, select: { id: true, ativo: true } }); }
  findById(id: string) { return this.db.lote.findUnique({ where: { id }, include: { organizacao: { select: { id: true, razaoSocial: true } }, _count: { select: { equipamentos: true } } } }); }
  list(input: { page: number; pageSize: number; q?: string; organizacaoId?: string; status?: string; ativo?: boolean; from?: Date; to?: Date }) {
    const where: Prisma.LoteWhereInput = { ...(input.organizacaoId ? { organizacaoId: input.organizacaoId } : {}), ...(input.status ? { statusProcessamento: input.status as never } : {}), ...(input.ativo === undefined ? {} : { ativo: input.ativo }), ...(input.from || input.to ? { dataEntrada: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {}), ...(input.q ? { OR: [{ notaFiscal: { contains: input.q.trim(), mode: "insensitive" } }, { transportadora: { contains: input.q.trim(), mode: "insensitive" } }, { observacoes: { contains: input.q.trim(), mode: "insensitive" } }] } : {}) };
    return Promise.all([this.db.lote.findMany({ where, include: { organizacao: { select: { id: true, razaoSocial: true } }, _count: { select: { equipamentos: true } } }, orderBy: [{ dataEntrada: "desc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.db.lote.count({ where })]);
  }
  create(data: Prisma.LoteUncheckedCreateInput) { return this.db.lote.create({ data, include: { organizacao: { select: { id: true, razaoSocial: true } }, _count: { select: { equipamentos: true } } } }); }
  updateVersioned(id: string, version: number, data: Prisma.LoteUpdateManyMutationInput) { return this.db.lote.updateMany({ where: { id, versao: version }, data }).then(r => r.count === 1 ? this.findById(id) : null); }
  equipmentCount(id: string) { return this.db.equipamento.count({ where: { loteId: id } }); }
  triageEligibleEquipmentCount(id: string) { return this.db.equipamento.count({ where: { loteId: id, ativo: true, statusRastreamento: "AGUARDANDO_TRIAGEM" } }); }
  inactiveEquipmentCount(id: string) { return this.db.equipamento.count({ where: { loteId: id, ativo: false } }); }
  triageEquipment(id: string) { return this.db.equipamento.updateMany({ where: { loteId: id, ativo: true, statusRastreamento: "AGUARDANDO_TRIAGEM" }, data: { statusRastreamento: "EM_TRIAGEM", versao: { increment: 1 } } }); }
  concludeTriageEquipment(id: string) { return this.db.equipamento.updateMany({ where: { loteId: id, ativo: true, statusRastreamento: "EM_TRIAGEM" }, data: { statusRastreamento: "AGUARDANDO_DESMONTE", versao: { increment: 1 } } }); }
  listEquipment(id: string, page: number, pageSize: number) { const where = { loteId: id }; return Promise.all([this.db.equipamento.findMany({ where, orderBy: [{ posicaoNoLote: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }), this.db.equipamento.count({ where })]); }
  findActorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
}
