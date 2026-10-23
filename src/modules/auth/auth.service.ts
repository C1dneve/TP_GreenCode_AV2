import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PapelUsuario } from "../../generated/prisma/client.js";
import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { AuthRepository } from "./auth.repository.js";

export interface JwtIssuer { sign(payload: JwtIdentity, options: { expiresIn: "30m"; algorithm: "HS256" }): string }
export interface JwtIdentity { sub: string; papel: PapelUsuario; jti: string; authVersion: number; iat?: number; exp?: number }
export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly jwt: JwtIssuer) {}

  async validateIdentity(identity: JwtIdentity) {
    const now = Math.floor(Date.now() / 1000);
    const allowedRoles: PapelUsuario[] = ["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"];
    const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.sub);
    if (!validUuid || typeof identity.jti !== "string" || !identity.jti || identity.jti.length > 100 || !Number.isInteger(identity.authVersion) || identity.authVersion < 1 || !allowedRoles.includes(identity.papel) || typeof identity.exp !== "number" || typeof identity.iat !== "number" || identity.exp <= now || identity.iat > now || identity.exp <= identity.iat) throw errors.unauthorized();
    const [user, revoked] = await Promise.all([this.repository.findByIdForAuth(identity.sub), this.repository.findRevoked(identity.jti)]);
    if (!user || !user.ativo || user.authVersion !== identity.authVersion || revoked) throw errors.unauthorized();
    return user;
  }

  async login(input: { usuario: string; senha: string }, requestId: string) {
    const username = input.usuario.trim().toLocaleLowerCase("pt-BR");
    const user = await this.repository.findByUsername(username);
    const valid = user
      ? await bcrypt.compare(input.senha, user.senhaHash)
      : await bcrypt.compare(input.senha, "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy").catch(() => false);
    if (!user || !valid || !user.ativo) {
      await this.repository.recordAudit({ atorUsuarioId: null, atorNomeSnapshot: null, acao: "LOGIN", entidade: "Autenticacao", entidadeId: "LOGIN", resultado: "FALHA", requestId });
      throw errors.unauthorized("INVALID_CREDENTIALS", "Usuário ou senha inválidos.");
    }
    const updated = await this.repository.transaction(async tx => {
      const accessed = await tx.updateLastAccess(user.id);
      await tx.recordAudit({ atorUsuarioId: user.id, atorNomeSnapshot: user.nome, acao: "LOGIN", entidade: "Usuario", entidadeId: user.id, resultado: "SUCESSO", requestId });
      return accessed;
    });
    const accessToken = this.jwt.sign({ sub: updated.id, papel: updated.papel, jti: randomUUID(), authVersion: updated.authVersion }, { expiresIn: "30m", algorithm: "HS256" });
    const { authVersion: _authVersion, ...usuario } = updated;
    return { accessToken, tokenType: "Bearer" as const, expiresIn: 1800, usuario };
  }

  async me(userId: string) {
    const user = await this.repository.findPublicById(userId);
    if (!user) throw errors.unauthorized();
    const { authVersion: _authVersion, ...publicUser } = user;
    return publicUser;
  }

  async logout(identity: JwtIdentity, requestId: string) {
    const expiraEm = new Date((identity.exp as number) * 1000);
    await this.repository.transaction(async (tx) => {
      await tx.revokeToken({ jti: identity.jti, usuarioId: identity.sub, expiraEm });
      const actor = await tx.findByIdForAuth(identity.sub);
      await tx.recordAudit({ atorUsuarioId: identity.sub, atorNomeSnapshot: actor?.nome, acao: "LOGOUT", entidade: "Usuario", entidadeId: identity.sub, resultado: "SUCESSO", requestId });
    });
  }

  async changePassword(identity: JwtIdentity, input: { senhaAtual: string; novaSenha: string }, requestId: string) {
    const user = await this.repository.findById(identity.sub);
    if (!user || !(await bcrypt.compare(input.senhaAtual, user.senhaHash))) throw errors.badRequest("INVALID_CURRENT_PASSWORD", "A senha atual é inválida.");
    if (input.novaSenha.length < 12) throw errors.badRequest("PASSWORD_POLICY_VIOLATION", "A nova senha deve ter pelo menos 12 caracteres.");
    const hash = await bcrypt.hash(input.novaSenha, 12);
    await this.repository.transaction(async (tx) => {
      const updated = await tx.updatePassword(user.id, user.authVersion, hash);
      if (!updated) throw errors.conflict("CONCURRENT_MODIFICATION", "A senha foi alterada por outra operação; autentique-se novamente.");
      await tx.recordAudit({ atorUsuarioId: user.id, atorNomeSnapshot: user.nome, acao: "ALTERACAO_SENHA", entidade: "Usuario", entidadeId: user.id, resultado: "SUCESSO", requestId });
    });
  }
}

export function normalizeAuthFailure(error: unknown): never {
  if (isPrismaCode(error, "P2002")) throw errors.conflict("BUSINESS_RULE_CONFLICT", "A operação conflita com um registro existente.");
  throw error;
}
