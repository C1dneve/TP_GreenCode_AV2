import { ParametrosService } from "./parametros.service.js";
export class ParametrosController { constructor(private readonly service: ParametrosService) {} get(actorRole: string) { return this.service.get(actorRole); } update(body: any, actorId: string, requestId: string, actorRole: string) { return this.service.update(body, actorId, requestId, actorRole); } }
