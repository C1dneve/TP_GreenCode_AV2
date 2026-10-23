import { MovimentacoesService } from "./movimentacoes.service.js";
export class MovimentacoesController {
  constructor(private readonly service: MovimentacoesService) {}
  create(equipamentoId: string, body: { destino: string; observacao?: string }, actorId: string, requestId: string, actorRole: string) { return this.service.create(equipamentoId, body, actorId, requestId, actorRole); }
  list(q: any, actorRole: string) { return this.service.list(q, actorRole); }
  get(id: string, actorRole: string) { return this.service.get(id, actorRole); }
  listForEquipment(id: string, page: number | undefined, pageSize: number | undefined, actorRole: string) { return this.service.listForEquipment(id, page, pageSize, actorRole); }
}
