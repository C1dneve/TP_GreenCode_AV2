import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";

type Db = PrismaClient | Prisma.TransactionClient;
const publicSelect = { id: true, usuario: true, nome: true, papel: true, ativo: true, ultimoAcesso: true, createdAt: true, updatedAt: true, versao: true, authVersion: true } as const;

export class AuthRepository {
  private readonly audit: AuditoriaRepository;
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) { this.audit = new AuditoriaRepository(db as PrismaClient); }
  async transaction<T>(callback: (repo: AuthRepository) => Promise<T>, serializable = false): Promise<T> {
    return this.root.$transaction(async (tx) => callback(new AuthRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined);
  }
  findByUsername(usuario: string) { return this.db.usuario.findUnique({ where: { usuario } }); }
  findById(id: string) { return this.db.usuario.findUnique({ where: { id } }); }
  findPublicById(id: string) { return this.db.usuario.findUnique({ where: { id }, select: publicSelect }); }
  findByIdForAuth(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { id: true, usuario: true, nome: true, papel: true, ativo: true, authVersion: true, versao: true } }); }
  findRevoked(jti: string) { return this.db.tokenRevogado.findUnique({ where: { jti }, select: { jti: true } }); }
  updateLastAccess(id: string) { return this.db.usuario.update({ where: { id }, data: { ultimoAcesso: new Date() }, select: publicSelect }); }
  revokeToken(input: { jti: string; usuarioId: string; expiraEm: Date }) { return this.db.tokenRevogado.upsert({ where: { jti: input.jti }, update: {}, create: input }); }
  updatePassword(id: string, expectedAuthVersion: number, senhaHash: string) {
    return this.db.usuario.updateMany({ where: { id, authVersion: expectedAuthVersion }, data: { senhaHash, authVersion: { increment: 1 }, versao: { increment: 1 } } }).then(result => result.count === 1);
  }
  recordAudit(input: EventoAuditoriaInput) { return this.audit.criar(input, this.db as Prisma.TransactionClient); }
}

export type PublicAuthUser = {
  id: string; usuario: string; nome: string; papel: string; ativo: boolean;
  ultimoAcesso?: Date | null; createdAt?: Date; updatedAt?: Date; versao?: number; authVersion: number;
};
