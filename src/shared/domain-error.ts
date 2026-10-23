export class DomainError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code;
}

export function publicError(statusCode: number, code: string, message: string): DomainError {
  return new DomainError(statusCode, code, message);
}

export const errors = {
  badRequest: (code: string, message: string) => new DomainError(400, code, message),
  unauthorized: (code = "UNAUTHENTICATED", message = "Autenticação inválida.") => new DomainError(401, code, message),
  forbidden: (message = "Permissão insuficiente.") => new DomainError(403, "FORBIDDEN", message),
  notFound: (code = "NOT_FOUND", message = "Recurso não encontrado.") => new DomainError(404, code, message),
  conflict: (code: string, message: string) => new DomainError(409, code, message),
};
