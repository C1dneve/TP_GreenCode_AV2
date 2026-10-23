import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class ContratosRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(callback: (repo: ContratosRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => callback(new ContratosRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  recordAudit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  actorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
  findOrganization(id: string) { return this.db.organizacao.findUnique({ where: { id }, select: { id: true, ativo: true, razaoSocial: true } }); }
  findById(id: string) { return this.db.contrato.findUnique({ where: { id }, include: { organizacao: { select: { id: true, razaoSocial: true, ativo: true } } } }); }
  list(input: { page: number; pageSize: number; organizacaoId?: string; status?: string; vencimentoDe?: Date; vencimentoAte?: Date }) {
    const now = new Date();
    const statusWhere: Prisma.ContratoWhereInput = input.status === "CANCELADO" ? { OR: [{ ativo: false }, { dataCancelamento: { not: null } }] } : input.status === "VENCIDO" ? { ativo: true, dataCancelamento: null } : input.status === "VIGENTE" ? { ativo: true, dataCancelamento: null } : {};
    const dueWhere = { ...(input.vencimentoDe ? { gte: input.vencimentoDe } : {}), ...(input.vencimentoAte ? { lte: input.vencimentoAte } : {}), ...(input.status === "VENCIDO" ? { lte: now } : {}), ...(input.status === "VIGENTE" ? { gt: now } : {}) };
    const where: Prisma.ContratoWhereInput = { ...statusWhere, ...(input.organizacaoId ? { organizacaoId: input.organizacaoId } : {}), ...(Object.keys(dueWhere).length ? { dataVencimento: dueWhere } : {}) };
    return Promise.all([this.db.contrato.findMany({ where, include: { organizacao: { select: { id: true, razaoSocial: true } } }, orderBy: [{ dataAssinatura: "desc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.db.contrato.count({ where })]);
  }
  listForOrganization(organizacaoId: string, page: number, pageSize: number) { const where = { organizacaoId }; return Promise.all([this.db.contrato.findMany({ where, orderBy: [{ dataAssinatura: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }), this.db.contrato.count({ where })]); }
  create(data: Prisma.ContratoUncheckedCreateInput) { return this.db.contrato.create({ data }); }
  updateVersioned(id: string, version: number, data: Prisma.ContratoUpdateManyMutationInput) { return this.db.contrato.updateMany({ where: { id, versao: version }, data }).then(async r => r.count === 1 ? this.findById(id) : null); }
  findActiveForOrganization(organizacaoId: string, now: Date) { return this.db.contrato.findFirst({ where: { organizacaoId, ativo: true, dataCancelamento: null, dataVencimento: { gt: now } }, orderBy: { dataVencimento: "desc" } }); }
  findOtherActiveForOrganization(organizacaoId: string, now: Date, excludeId: string) {
    return this.db.contrato.findFirst({ where: { organizacaoId, id: { not: excludeId }, ativo: true, dataCancelamento: null, dataVencimento: { gt: now } } });
  }
}
