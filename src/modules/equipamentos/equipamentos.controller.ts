import { EquipamentosService } from "./equipamentos.service.js";
export class EquipamentosController {
  constructor(private readonly service: EquipamentosService) {}
  list(q: any, actorRole: string) { return this.service.list(q, actorRole); } get(id: string, actorRole: string) { return this.service.get(id, actorRole); }
  create(body: any, actorId: string, requestId: string, actorRole: string) { return this.service.create(body, actorId, requestId, actorRole); }
  update(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.update(id, body, actorId, requestId, actorRole); }
  changePhysical(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.changePhysicalState(id, body, actorId, requestId, actorRole); }
  changeTracking(id: string, body: any, actorId: string, requestId: string, actorRole: string) { return this.service.changeTrackingStatus(id, body, actorId, requestId, actorRole); }
  activeChange(id: string, activate: boolean, version: number, actorId: string, requestId: string, actorRole: string) { return this.service.activeChange(id, activate, version, actorId, requestId, actorRole); }
}
