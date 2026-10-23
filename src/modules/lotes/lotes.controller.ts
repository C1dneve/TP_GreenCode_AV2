import { LotesService } from "./lotes.service.js";
export class LotesController {
  constructor(private readonly service: LotesService) {}
  list(q: any, actorRole: string) { return this.service.list(q, actorRole); } get(id: string, actorRole: string) { return this.service.get(id, actorRole); }
  create(body: any, actorId: string, requestId: string, actorRole: string) { return this.service.create(body, actorId, requestId, actorRole); }
  update(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.update(id, body, actorId, requestId, actorRole); }
  triage(id: string, version: number | undefined, actorId: string, requestId: string, actorRole: string) { return this.service.triage(id, version, actorId, requestId, actorRole); }
  lifecycle(id: string, action: "encaminhamento" | "finalizacao" | "desativacao" | "reativacao", version: number | undefined, actorId: string, requestId: string, actorRole: string) { return this.service.lifecycle(id, action, version, actorId, requestId, actorRole); }
  equipment(id: string, page: number, pageSize: number, actorRole: string) { return this.service.equipment(id, page, pageSize, actorRole); }
}
