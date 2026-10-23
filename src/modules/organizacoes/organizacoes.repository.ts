import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
const orgSelect = { id: true, razaoSocial: true, cnpj: true, inscricaoEstadual: true, enderecoCompleto: true, telefone: true, email: true, dataCadastro: true, ativo: true, createdAt: true, updatedAt: true, versao: true } as const;
export class OrganizacoesRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(callback: (repo: OrganizacoesRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => callback(new OrganizacoesRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  private record(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  list(input: { page: number; pageSize: number; q?: string; ativo?: boolean }) {
    const where: Prisma.OrganizacaoWhereInput = { ...(input.ativo === undefined ? {} : { ativo: input.ativo }), ...(input.q ? { OR: [{ razaoSocial: { contains: input.q.trim(), mode: "insensitive" } }, { cnpj: { contains: input.q.replace(/\D/g, "") } }, { email: { contains: input.q.trim(), mode: "insensitive" } }, { telefone: { contains: input.q.trim() } }] } : {}) };
    return Promise.all([this.db.organizacao.findMany({ where, select: { ...orgSelect, contratos: { where: { ativo: true, dataCancelamento: null, dataVencimento: { gt: new Date() } }, select: { id: true }, take: 1 } }, orderBy: [{ razaoSocial: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }), this.db.organizacao.count({ where })]);
  }
  findById(id: string) { return this.db.organizacao.findUnique({ where: { id }, select: { ...orgSelect, contratos: { where: { ativo: true, dataCancelamento: null, dataVencimento: { gt: new Date() } }, select: { id: true }, take: 1 } } }); }
  create(data: Prisma.OrganizacaoCreateInput) { return this.db.organizacao.create({ data, select: orgSelect }); }
  updateVersioned(id: string, version: number, data: Prisma.OrganizacaoUpdateManyMutationInput) { return this.db.organizacao.updateMany({ where: { id, versao: version }, data }).then(r => r.count === 1 ? this.findById(id) : null); }
  findActorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
  countOpenLots(organizacaoId: string) { return this.db.lote.count({ where: { organizacaoId, statusProcessamento: { not: "FINALIZADO" } } }); }
  recordAudit(input: EventoAuditoriaInput) { return this.record(input); }
}
