import { AuditoriaConsultaService } from "./auditoria-consulta.service.js";
export class AuditoriaConsultaController { constructor(private readonly service: AuditoriaConsultaService) {} list(q: any, actorRole: string) { return this.service.list(q, actorRole); } }
