import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { MovimentacoesRepository } from "./movimentacoes.repository.js";
function parseDate(value: string | undefined) { if (!value) return undefined; const d = new Date(value); if (!Number.isFinite(d.getTime())) throw errors.badRequest("VALIDATION_ERROR", "Data de filtro inválida."); return d; }
export class MovimentacoesService {
  constructor(private readonly repo: MovimentacoesRepository) {}
  async create(equipamentoId: string, body: { destino: string; observacao?: string }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    const destino = body.destino.trim(); if (!destino) throw errors.badRequest("VALIDATION_ERROR", "Destino é obrigatório.");
    try { return await this.repo.transaction(async tx => { const equipment = await tx.findEquipment(equipamentoId); if (!equipment) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); if (!equipment.ativo) throw errors.conflict("EQUIPMENT_INACTIVE", "Equipamento desativado não pode ser movimentado."); const actor = await tx.findActor(actorId); if (!actor || !actor.ativo) throw errors.unauthorized(); const latest = await tx.latestForEquipment(equipamentoId); const origem = latest?.destino ?? (equipment.lote?.notaFiscal ? `Lote ${equipment.lote.notaFiscal}` : "Origem inicial"); const created = await tx.create({ equipamentoId, origem, destino, responsavelId: actorId, responsavelNomeSnapshot: actor.nome, observacao: body.observacao?.trim() ?? "", dataHora: new Date() }); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor.nome, acao: "CRIACAO_MOVIMENTACAO", entidade: "Movimentacao", entidadeId: created.id, resultado: "SUCESSO", requestId, detalhes: { equipamentoId, origem, destino } }); return created; }, true); }
    catch (error) { if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "Movimentação conflitou com outra operação; tente novamente."); throw error; }
  }
  async list(input: { page?: number; pageSize?: number; equipamentoId?: string; responsavelId?: string; de?: string; ate?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]);
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20))); const de = parseDate(input.de); const ate = parseDate(input.ate); if (de && ate && de > ate) throw errors.badRequest("VALIDATION_ERROR", "de não pode ser posterior a ate."); const [data, total] = await this.repo.list({ page, pageSize, equipamentoId: input.equipamentoId, responsavelId: input.responsavelId, de, ate }); return { data, meta: pageMeta(page, pageSize, total) };
  }
  async get(id: string, actorRole: string) { assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]); const movement = await this.repo.findById(id); if (!movement) throw errors.notFound("MOVEMENT_NOT_FOUND", "Movimentação não encontrada."); return movement; }
  async listForEquipment(id: string, page: number | undefined, pageSize: number | undefined, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]); if (!(await this.repo.findEquipment(id))) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); const p = Math.max(1, Math.trunc(page ?? 1)); const n = Math.min(100, Math.max(1, Math.trunc(pageSize ?? 20))); const [data, total] = await this.repo.listForEquipment(id, p, n); return { data, meta: pageMeta(p, n, total) }; }
}
