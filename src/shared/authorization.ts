import { errors } from "./domain-error.js";

export type PapelAutorizado = "ADMINISTRADOR" | "OPERADOR_CADASTRO" | "GESTOR_ALMOXARIFADO" | "AUDITOR";

/** Revalida autorização na camada de caso de uso. O papel vem do middleware JWT,
 * que substitui a claim pelo papel atual persistido do usuário ativo. */
export function assertRole(actorRole: string, allowedRoles: readonly PapelAutorizado[]): void {
  if (!allowedRoles.includes(actorRole as PapelAutorizado)) throw errors.forbidden();
}
