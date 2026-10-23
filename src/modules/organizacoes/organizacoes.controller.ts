import { OrganizacoesService } from "./organizacoes.service.js";
export class OrganizacoesController {
  constructor(private readonly service: OrganizacoesService) {}
  list(q: { page?: number; pageSize?: number; q?: string; ativo?: boolean }, actorRole: string) { return this.service.list(q, actorRole); }
  get(id: string, actorRole: string) { return this.service.get(id, actorRole); }
  create(body: { razaoSocial: string; cnpj: string; inscricaoEstadual?: string; enderecoCompleto?: string; telefone?: string; email?: string }, actorId: string, requestId: string, actorRole: string) { return this.service.create(body, actorId, requestId, actorRole); }
  update(id: string, body: { versaoEsperada: number; razaoSocial?: string; cnpj?: string; inscricaoEstadual?: string | null; enderecoCompleto?: string | null; telefone?: string | null; email?: string | null }, actorId: string, requestId: string, actorRole: string) { return this.service.update(id, body, actorId, requestId, actorRole); }
  deactivate(id: string, version: number | undefined, actorId: string, requestId: string, actorRole: string) { return this.service.deactivate(id, version, actorId, requestId, actorRole); }
  reactivate(id: string, version: number | undefined, actorId: string, requestId: string, actorRole: string) { return this.service.reactivate(id, version, actorId, requestId, actorRole); }
}
