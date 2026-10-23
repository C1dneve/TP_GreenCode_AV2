import type { PapelUsuario } from "../../generated/prisma/client.js";
import { UsuariosService } from "./usuarios.service.js";
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}
  list(query: { page?: number; pageSize?: number; busca?: string; papel?: PapelUsuario; ativo?: boolean }, actorRole: string) { return this.service.list(query, actorRole); }
  create(body: { usuario: string; nome: string; senha: string; papel: PapelUsuario }, actorId: string, requestId: string, actorRole: string) { return this.service.create(body, actorId, requestId, actorRole); }
  get(id: string, actorRole: string) { return this.service.get(id, actorRole); }
  update(id: string, body: { versaoEsperada: number; usuario?: string; nome?: string; papel?: PapelUsuario }, actorId: string, requestId: string, actorRole: string) { return this.service.update(id, body, actorId, requestId, actorRole); }
  deactivate(id: string, actorId: string, requestId: string, actorRole: string) { return this.service.deactivate(id, actorId, requestId, actorRole); }
  reactivate(id: string, actorId: string, requestId: string, actorRole: string) { return this.service.reactivate(id, actorId, requestId, actorRole); }
  resetPassword(id: string, novaSenha: string, actorId: string, requestId: string, actorRole: string) { return this.service.resetPassword(id, novaSenha, actorId, requestId, actorRole); }
}
