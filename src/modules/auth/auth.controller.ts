import type { JwtIdentity } from "./auth.service.js";
import { AuthService } from "./auth.service.js";
export class AuthController {
  constructor(private readonly service: AuthService) {}
  login(body: { usuario: string; senha: string }, requestId: string) { return this.service.login(body, requestId); }
  me(identity: JwtIdentity) { return this.service.me(identity.sub); }
  logout(identity: JwtIdentity, requestId: string) { return this.service.logout(identity, requestId); }
  changePassword(identity: JwtIdentity, body: { senhaAtual: string; novaSenha: string }, requestId: string) { return this.service.changePassword(identity, body, requestId); }
}
