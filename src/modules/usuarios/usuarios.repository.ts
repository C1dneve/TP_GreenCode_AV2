import type { Prisma, PrismaClient, PapelUsuario } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export const publicUserSelect = { id: true, usuario: true, nome: true, papel: true, ativo: true, ultimoAcesso: true, createdAt: true, updatedAt: true, versao: true } as const;
export interface UserFilter { page: number; pageSize: number; busca?: string; papel?: PapelUsuario; ativo?: boolean }
export class UsuariosRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  async transaction<T>(callback: (repo: UsuariosRepository) => Promise<T>, serializable = false): Promise<T> {
    return this.root.$transaction(async (tx) => callback(new UsuariosRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined);
  }
  private audit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
  async list(filter: UserFilter) {
    const where: Prisma.UsuarioWhereInput = { ...(filter.papel ? { papel: filter.papel } : {}), ...(filter.ativo === undefined ? {} : { ativo: filter.ativo }), ...(filter.busca ? { OR: [{ usuario: { contains: filter.busca.trim().toLowerCase() } }, { nome: { contains: filter.busca.trim(), mode: "insensitive" } }] } : {}) };
    const [data, total] = await Promise.all([this.db.usuario.findMany({ where, select: publicUserSelect, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (filter.page - 1) * filter.pageSize, take: filter.pageSize }), this.db.usuario.count({ where })]);
    return { data, total };
  }
  findById(id: string) { return this.db.usuario.findUnique({ where: { id } }); }
  findPublicById(id: string) { return this.db.usuario.findUnique({ where: { id }, select: publicUserSelect }); }
  findActorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
  countActiveAdmins() { return this.db.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR" } }); }
  create(data: { usuario: string; nome: string; senhaHash: string; papel: PapelUsuario }) { return this.db.usuario.create({ data, select: publicUserSelect }); }
  updateByVersion(id: string, versaoEsperada: number, data: Prisma.UsuarioUpdateManyMutationInput) {
    return this.db.usuario.updateMany({ where: { id, versao: versaoEsperada }, data }).then(async (result) => result.count === 1 ? this.findPublicById(id) : null);
  }
  deactivate(id: string) { return this.db.usuario.update({ where: { id }, data: { ativo: false, versao: { increment: 1 }, authVersion: { increment: 1 } } }); }
  reactivate(id: string) { return this.db.usuario.update({ where: { id }, data: { ativo: true, versao: { increment: 1 }, authVersion: { increment: 1 } } }); }
  resetPassword(id: string, expectedAuthVersion: number, senhaHash: string) {
    return this.db.usuario.updateMany({ where: { id, authVersion: expectedAuthVersion }, data: { senhaHash, authVersion: { increment: 1 }, versao: { increment: 1 } } }).then(result => result.count === 1);
  }
  recordAudit(input: EventoAuditoriaInput) { return this.audit(input); }
}
