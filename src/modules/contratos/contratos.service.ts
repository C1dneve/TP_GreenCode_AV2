import type { Prisma } from "../../generated/prisma/client.js";
import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { requireExpectedVersion } from "../../shared/version.js";
import { ContratosRepository } from "./contratos.repository.js";
function status(row: { ativo: boolean; dataCancelamento: Date | null; dataVencimento: Date }, now = new Date()) { return !row.ativo || row.dataCancelamento ? "CANCELADO" : row.dataVencimento > now ? "VIGENTE" : "VENCIDO"; }
function view(row: any) { if (!row) return row; return { ...row, status: status(row) }; }
function date(value: string) { const parsed = new Date(value); if (Number.isNaN(parsed.getTime())) throw errors.badRequest("VALIDATION_ERROR", "Data inválida."); return parsed; }
function money(value: string | number) { const numeric = Number(value); if (!Number.isFinite(numeric) || numeric < 0 || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw errors.badRequest("VALIDATION_ERROR", "Valor mensal deve ser decimal não negativo com até duas casas."); return numeric.toFixed(2); }
export class ContratosService {
  constructor(private readonly repository: ContratosRepository) {}
  async list(input: { page?: number; pageSize?: number; organizacaoId?: string; status?: string; vencimentoDe?: string; vencimentoAte?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20)));
    const from = input.vencimentoDe ? date(input.vencimentoDe) : undefined; const to = input.vencimentoAte ? date(input.vencimentoAte) : undefined;
    if (from && to && from > to) throw errors.badRequest("VALIDATION_ERROR", "vencimentoDe não pode ser posterior a vencimentoAte.");
    const [rows, total] = await this.repository.list({ page, pageSize, organizacaoId: input.organizacaoId, status: input.status, vencimentoDe: from, vencimentoAte: to });
    return { data: rows.map(view), meta: pageMeta(page, pageSize, total) };
  }
  async listForOrganization(orgId: string, input: { page?: number; pageSize?: number }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    if (!(await this.repository.findOrganization(orgId))) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada.");
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20)));
    const [rows, total] = await this.repository.listForOrganization(orgId, page, pageSize);
    return { data: rows.map(view), meta: pageMeta(page, pageSize, total) };
  }
  async get(id: string, orgId: string | undefined, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const row = await this.repository.findById(id);
    if (!row || (orgId && row.organizacaoId !== orgId)) throw errors.notFound("CONTRACT_NOT_FOUND", "Contrato não encontrado.");
    return view(row);
  }
  async create(orgId: string, input: { dataVencimento: string; valorMensal: string; clausulas?: string[]; renovacaoAutomatica?: boolean }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const vencimento = date(input.dataVencimento); if (vencimento <= new Date()) throw errors.badRequest("VALIDATION_ERROR", "O vencimento deve ser posterior ao instante atual.");
    const valorMensal = money(input.valorMensal); if (input.clausulas?.some(x => typeof x !== "string" || !x.trim())) throw errors.badRequest("VALIDATION_ERROR", "Cláusulas devem ser textos não vazios.");
    try { return await this.repository.transaction(async tx => {
      const org = await tx.findOrganization(orgId); if (!org) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada."); if (!org.ativo) throw errors.conflict("ORGANIZATION_INACTIVE", "Não é possível criar contrato para organização desativada.");
      if (await tx.findActiveForOrganization(orgId, new Date())) throw errors.conflict("ACTIVE_CONTRACT_EXISTS", "A organização já possui contrato vigente.");
      const created = await tx.create({ organizacaoId: orgId, dataVencimento: vencimento, valorMensal, clausulas: input.clausulas ?? [], renovacaoAutomatica: input.renovacaoAutomatica ?? false });
      const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "CRIACAO_CONTRATO", entidade: "Contrato", entidadeId: created.id, resultado: "SUCESSO", requestId }); return view(created);
    }, true); } catch (error) { if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "Operação concorrente de contrato; tente novamente."); throw error; }
  }
  async update(id: string, input: { versaoEsperada: number; dataVencimento?: string; valorMensal?: string; clausulas?: string[]; renovacaoAutomatica?: boolean }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const { versaoEsperada, ...fields } = input; requireExpectedVersion(versaoEsperada); if (!Object.keys(fields).length) throw errors.badRequest("VALIDATION_ERROR", "Informe ao menos um campo para atualização.");
    return this.repository.transaction(async tx => { const current = await tx.findById(id); if (!current) throw errors.notFound("CONTRACT_NOT_FOUND", "Contrato não encontrado."); if (current.versao !== versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação."); if (status(current) === "CANCELADO") throw errors.conflict("CONTRACT_CANCELLED", "Contrato cancelado não pode ser atualizado.");
      const data: Prisma.ContratoUpdateManyMutationInput = { versao: { increment: 1 } }; if (fields.dataVencimento !== undefined) {
        const v = date(fields.dataVencimento); const now = new Date();
        if (v <= now) throw errors.badRequest("VALIDATION_ERROR", "O vencimento deve ser futuro.");
        if (await tx.findOtherActiveForOrganization(current.organizacaoId, now, current.id)) throw errors.conflict("ACTIVE_CONTRACT_EXISTS", "A organização já possui outro contrato vigente.");
        data.dataVencimento = v;
      } if (fields.valorMensal !== undefined) data.valorMensal = money(fields.valorMensal); if (fields.clausulas !== undefined) data.clausulas = fields.clausulas; if (fields.renovacaoAutomatica !== undefined) data.renovacaoAutomatica = fields.renovacaoAutomatica;
      const updated = await tx.updateVersioned(id, versaoEsperada, data); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ATUALIZACAO_CONTRATO", entidade: "Contrato", entidadeId: id, resultado: "SUCESSO", requestId }); return view(updated);
    }, true);
  }
  async renew(id: string, input: { dataVencimento: string; valorMensal?: string; clausulas?: string[]; renovacaoAutomatica?: boolean; versaoEsperada: number }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    requireExpectedVersion(input.versaoEsperada);
    const nextDate = date(input.dataVencimento);
    try { return await this.repository.transaction(async tx => { const old = await tx.findById(id); if (!old) throw errors.notFound("CONTRACT_NOT_FOUND", "Contrato não encontrado."); if (input.versaoEsperada !== old.versao) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação."); if (status(old) !== "VIGENTE") throw errors.conflict("CONTRACT_NOT_RENEWABLE", "Somente contrato vigente pode ser renovado."); if (nextDate <= old.dataVencimento) throw errors.badRequest("VALIDATION_ERROR", "Novo vencimento deve ser posterior ao anterior.");
      const closed = await tx.updateVersioned(id, input.versaoEsperada, { ativo: false, dataCancelamento: new Date(), versao: { increment: 1 } }); if (!closed) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação.");
      const created = await tx.create({ organizacaoId: old.organizacaoId, dataVencimento: nextDate, valorMensal: input.valorMensal === undefined ? old.valorMensal : money(input.valorMensal), clausulas: input.clausulas ?? old.clausulas, renovacaoAutomatica: input.renovacaoAutomatica ?? old.renovacaoAutomatica });
      const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "RENOVACAO_CONTRATO_ENCERRAMENTO", entidade: "Contrato", entidadeId: old.id, resultado: "SUCESSO", requestId, detalhes: { novoContratoId: created.id } }); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "RENOVACAO_CONTRATO_CRIACAO", entidade: "Contrato", entidadeId: created.id, resultado: "SUCESSO", requestId, detalhes: { contratoAnteriorId: old.id } }); return view(created);
    }, true); } catch (error) { if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "Operação concorrente de renovação; tente novamente."); throw error; }
  }
  async cancel(id: string, version: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    requireExpectedVersion(version);
    await this.repository.transaction(async tx => { const row = await tx.findById(id); if (!row) throw errors.notFound("CONTRACT_NOT_FOUND", "Contrato não encontrado."); if (version !== row.versao) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação."); if (status(row) === "CANCELADO") throw errors.conflict("CONTRACT_ALREADY_CANCELLED", "Contrato já está cancelado."); const updated = await tx.updateVersioned(id, version, { ativo: false, dataCancelamento: new Date(), versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Contrato alterado por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "CANCELAMENTO_CONTRATO", entidade: "Contrato", entidadeId: id, resultado: "SUCESSO", requestId }); }, true);
  }
}
