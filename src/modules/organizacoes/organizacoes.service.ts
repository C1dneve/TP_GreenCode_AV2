import type { Prisma } from "../../generated/prisma/client.js";
import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { requireExpectedVersion } from "../../shared/version.js";
import { OrganizacoesRepository } from "./organizacoes.repository.js";

function normalizeCnpj(value: string): string { return value.replace(/\D/g, ""); }
export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || /^([0-9])\1{13}$/.test(cnpj)) return false;
  const digit = (base: string, weights: number[]) => { const sum = [...base].reduce((acc, char, index) => acc + Number(char) * weights[index]!, 0); const mod = sum % 11; return mod < 2 ? 0 : 11 - mod; };
  const first = digit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}
const output = (row: any) => { if (!row) return row; const { contratos, ...rest } = row; return { ...rest, contratoVigenteId: contratos?.[0]?.id ?? null }; };
export class OrganizacoesService {
  constructor(private readonly repository: OrganizacoesRepository) {}
  async list(input: { page?: number; pageSize?: number; q?: string; ativo?: boolean }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20)));
    const [rows, total] = await this.repository.list({ ...input, page, pageSize });
    return { data: rows.map(output), meta: pageMeta(page, pageSize, total) };
  }
  async get(id: string, actorRole: string) { assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]); const row = await this.repository.findById(id); if (!row) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada."); return output(row); }
  async create(input: { razaoSocial: string; cnpj: string; inscricaoEstadual?: string; enderecoCompleto?: string; telefone?: string; email?: string }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const razaoSocial = input.razaoSocial.trim(); const cnpj = normalizeCnpj(input.cnpj);
    if (!razaoSocial || !isValidCnpj(cnpj)) throw errors.badRequest("VALIDATION_ERROR", "Razão social e CNPJ válido são obrigatórios.");
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw errors.badRequest("VALIDATION_ERROR", "E-mail inválido.");
    const data: Prisma.OrganizacaoCreateInput = { razaoSocial, cnpj, inscricaoEstadual: input.inscricaoEstadual?.trim() || null, enderecoCompleto: input.enderecoCompleto?.trim() || null, telefone: input.telefone?.trim() || null, email: input.email?.trim().toLowerCase() || null };
    try { return await this.repository.transaction(async tx => { const created = await tx.create(data); const actor = await tx.findActorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "CRIACAO_ORGANIZACAO", entidade: "Organizacao", entidadeId: created.id, resultado: "SUCESSO", requestId }); return created; }, true); }
    catch (error) { if (isPrismaCode(error, "P2002")) throw errors.conflict("DUPLICATE_CNPJ", "Já existe uma organização cadastrada com esse CNPJ."); if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "A operação conflitou com outra alteração."); throw error; }
  }
  async update(id: string, input: { versaoEsperada: number; razaoSocial?: string; cnpj?: string; inscricaoEstadual?: string | null; enderecoCompleto?: string | null; telefone?: string | null; email?: string | null }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    const { versaoEsperada, ...fields } = input; requireExpectedVersion(versaoEsperada); if (!Object.keys(fields).length) throw errors.badRequest("VALIDATION_ERROR", "Informe ao menos um campo para atualização.");
    const current = await this.repository.findById(id); if (!current) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada."); if (current.versao !== versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação."); if (!current.ativo) throw errors.conflict("ORGANIZATION_INACTIVE", "Não é permitido atualizar organização desativada.");
    const data: Prisma.OrganizacaoUpdateManyMutationInput = { versao: { increment: 1 } };
    if (fields.razaoSocial !== undefined) { if (!fields.razaoSocial.trim()) throw errors.badRequest("VALIDATION_ERROR", "Razão social não pode ficar vazia."); data.razaoSocial = fields.razaoSocial.trim(); }
    if (fields.cnpj !== undefined) { const cnpj = normalizeCnpj(fields.cnpj); if (!isValidCnpj(cnpj)) throw errors.badRequest("VALIDATION_ERROR", "CNPJ inválido."); data.cnpj = cnpj; }
    if (fields.inscricaoEstadual !== undefined) data.inscricaoEstadual = fields.inscricaoEstadual?.trim() || null;
    if (fields.enderecoCompleto !== undefined) data.enderecoCompleto = fields.enderecoCompleto?.trim() || null;
    if (fields.telefone !== undefined) data.telefone = fields.telefone?.trim() || null;
    if (fields.email !== undefined) { if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) throw errors.badRequest("VALIDATION_ERROR", "E-mail inválido."); data.email = fields.email?.trim().toLowerCase() || null; }
    try { return await this.repository.transaction(async tx => { const updated = await tx.updateVersioned(id, versaoEsperada, data); if (!updated) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação."); const actor = await tx.findActorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ATUALIZACAO_ORGANIZACAO", entidade: "Organizacao", entidadeId: id, resultado: "SUCESSO", requestId }); return output(updated); }, true); }
    catch (error) { if (isPrismaCode(error, "P2002")) throw errors.conflict("DUPLICATE_CNPJ", "Já existe uma organização cadastrada com esse CNPJ."); if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "A operação conflitou com outra alteração."); throw error; }
  }
  async deactivate(id: string, version: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    requireExpectedVersion(version);
    await this.repository.transaction(async tx => {
      const current = await tx.findById(id); if (!current) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada.");
      if (version !== current.versao) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação.");
      if (!current.ativo) throw errors.conflict("ORGANIZATION_ALREADY_INACTIVE", "A organização já está desativada.");
      if (await tx.countOpenLots(id)) throw errors.conflict("ORGANIZATION_HAS_OPEN_LOTS", "Não é possível desativar organização com lotes não finalizados.");
      const updated = await tx.updateVersioned(id, version, { ativo: false, versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação.");
      const actor = await tx.findActorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "DESATIVACAO_ORGANIZACAO", entidade: "Organizacao", entidadeId: id, resultado: "SUCESSO", requestId });
    }, true);
  }
  async reactivate(id: string, version: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "OPERADOR_CADASTRO"]);
    requireExpectedVersion(version);
    await this.repository.transaction(async tx => { const current = await tx.findById(id); if (!current) throw errors.notFound("ORGANIZATION_NOT_FOUND", "Organização não encontrada."); if (version !== current.versao) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação."); if (current.ativo) throw errors.conflict("ORGANIZATION_ALREADY_ACTIVE", "A organização já está ativa."); const updated = await tx.updateVersioned(id, version, { ativo: true, versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "A organização foi alterada por outra operação."); const actor = await tx.findActorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "REATIVACAO_ORGANIZACAO", entidade: "Organizacao", entidadeId: id, resultado: "SUCESSO", requestId }); }, true);
  }
}
