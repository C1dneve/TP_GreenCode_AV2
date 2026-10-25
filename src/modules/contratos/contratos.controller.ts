import { ContratosService } from "./contratos.service.js";
export class ContratosController {
  constructor(private readonly service: ContratosService) {}
  list(q: any, actorRole: string) { return this.service.list(q, actorRole); }
  listForOrganization(id: string, q: any, actorRole: string) { return this.service.listForOrganization(id, q, actorRole); }
  get(id: string, orgId: string | undefined, actorRole: string) { return this.service.get(id, orgId, actorRole); }
  create(orgId: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.create(orgId, body, actorId, requestId, actorRole); }
  update(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.update(id, body, actorId, requestId, actorRole); }
  renew(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.renew(id, body, actorId, requestId, actorRole); }
  cancel(id: string, version: number, actorId: string, requestId: string, actorRole: string) { return this.service.cancel(id, version, actorId, requestId, actorRole); }
}
