import { errors } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { AuditoriaConsultaRepository } from "./auditoria.repository.js";
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) if (!/senha|hash|token|secret|authorization|credential|database.?url|jwt/i.test(key)) result[key] = sanitize(val);
  return result;
}
function parse(value: string | undefined) { if (!value) return undefined; const d = new Date(value); if (!Number.isFinite(d.getTime())) throw errors.badRequest("VALIDATION_ERROR", "Data de filtro inválida."); return d; }
export class AuditoriaConsultaService {
  constructor(private readonly repository: AuditoriaConsultaRepository) {}
  async list(input: { page?: number; pageSize?: number; entidade?: string; entidadeId?: string; acao?: string; resultado?: string; de?: string; ate?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]);
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20))); const de = parse(input.de); const ate = parse(input.ate); if (de && ate && de > ate) throw errors.badRequest("VALIDATION_ERROR", "de não pode ser posterior a ate.");
    const [data, total] = await this.repository.list({ page, pageSize, entidade: input.entidade, entidadeId: input.entidadeId, acao: input.acao, resultado: input.resultado, de, ate });
    return { data: data.map(event => ({ ...event, detalhes: sanitize(event.detalhes) })), meta: pageMeta(page, pageSize, total) };
  }
}
