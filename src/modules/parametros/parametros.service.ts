import type { Prisma } from "../../generated/prisma/client.js";
import { errors } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { requireExpectedVersion } from "../../shared/version.js";
import { ParametrosRepository } from "./parametros.repository.js";
function percent(value: string | number, field: string) { const n = Number(value); const text = String(value); if (!Number.isFinite(n) || n < 0 || n > 100 || !/^\d+(\.\d{1,2})?$/.test(text)) throw errors.badRequest("VALIDATION_ERROR", `${field} deve estar entre 0 e 100, com até duas casas decimais.`); return n.toFixed(2); }
export class ParametrosService {
  constructor(private readonly repo: ParametrosRepository) {}
  async get(actorRole: string) { assertRole(actorRole, ["ADMINISTRADOR"]); const row = await this.repo.find(); if (!row) throw errors.notFound("PARAMETERS_NOT_INITIALIZED", "Parâmetros globais ainda não foram inicializados pelo seed."); return row; }
  async update(input: { versaoEsperada: number; aliquotaImpostoPercentual?: string | number; taxaDepreciacaoAnualPercentual?: string | number }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    requireExpectedVersion(input.versaoEsperada);
    if (input.aliquotaImpostoPercentual === undefined && input.taxaDepreciacaoAnualPercentual === undefined) throw errors.badRequest("VALIDATION_ERROR", "Informe ao menos um parâmetro para alteração.");
    const data: Prisma.ParametroGlobalUncheckedUpdateManyInput = { versao: { increment: 1 }, atualizadoPorId: actorId };
    if (input.aliquotaImpostoPercentual !== undefined) data.aliquotaImpostoPercentual = percent(input.aliquotaImpostoPercentual, "Alíquota de imposto");
    if (input.taxaDepreciacaoAnualPercentual !== undefined) data.taxaDepreciacaoAnualPercentual = percent(input.taxaDepreciacaoAnualPercentual, "Taxa de depreciação");
    return this.repo.transaction(async tx => { const current = await tx.find(); if (!current) throw errors.notFound("PARAMETERS_NOT_INITIALIZED", "Parâmetros globais ainda não foram inicializados pelo seed."); if (current.versao !== input.versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "Parâmetros alterados por outra operação."); const updated = await tx.update(input.versaoEsperada, data); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Parâmetros alterados por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ATUALIZACAO_PARAMETROS_GLOBAIS", entidade: "ParametroGlobal", entidadeId: "global", resultado: "SUCESSO", requestId, detalhes: { aliquotaImpostoPercentual: input.aliquotaImpostoPercentual === undefined ? Number(current.aliquotaImpostoPercentual) : Number(input.aliquotaImpostoPercentual), taxaDepreciacaoAnualPercentual: input.taxaDepreciacaoAnualPercentual === undefined ? Number(current.taxaDepreciacaoAnualPercentual) : Number(input.taxaDepreciacaoAnualPercentual) } }); return updated; }, true);
  }
}
