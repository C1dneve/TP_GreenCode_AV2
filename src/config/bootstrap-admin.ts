export interface BootstrapAdminConfig {
  usuario: string;
  nome: string;
  senha: string;
}

/**
 * Returns null when no bootstrap field is configured. Partial configuration is
 * rejected before the seed mutates the database. Secret values are never included
 * in errors.
 */
export function getBootstrapAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): BootstrapAdminConfig | null {
  const usuario = env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase() || undefined;
  const nome = env.BOOTSTRAP_ADMIN_NAME?.trim() || undefined;
  const senha = env.BOOTSTRAP_ADMIN_PASSWORD || undefined;
  const configuredCount = [usuario, nome, senha].filter((value) => value !== undefined).length;

  if (configuredCount === 0) return null;

  if (configuredCount !== 3) {
    throw new Error(
      'Configuração incompleta: informe BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME e BOOTSTRAP_ADMIN_PASSWORD em conjunto.',
    );
  }

  if (!usuario || !nome || senha === undefined) {
    throw new Error(
      'Configuração incompleta: informe BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME e BOOTSTRAP_ADMIN_PASSWORD em conjunto.',
    );
  }

  if (senha.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.');
  }

  return { usuario, nome, senha };
}
