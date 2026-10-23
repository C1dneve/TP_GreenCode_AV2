import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AuditoriaRepository } from "../auditoria/auditoria.repository.js";
import type { EventoAuditoriaInput } from "../auditoria/auditoria.repository.js";
type Db = PrismaClient | Prisma.TransactionClient;
export class ParametrosRepository {
  constructor(private readonly root: PrismaClient, private readonly db: Db = root) {}
  transaction<T>(cb: (repo: ParametrosRepository) => Promise<T>, serializable = false) { return this.root.$transaction(async tx => cb(new ParametrosRepository(this.root, tx)), serializable ? { isolationLevel: "Serializable" } : undefined); }
  find() { return this.db.parametroGlobal.findUnique({ where: { id: "global" } }); }
  update(version: number, data: Prisma.ParametroGlobalUncheckedUpdateManyInput) { return this.db.parametroGlobal.updateMany({ where: { id: "global", versao: version }, data }).then(async r => r.count === 1 ? this.find() : null); }
  actorName(id: string) { return this.db.usuario.findUnique({ where: { id }, select: { nome: true } }); }
  recordAudit(input: EventoAuditoriaInput) { return new AuditoriaRepository(this.root).criar(input, this.db as Prisma.TransactionClient); }
}
