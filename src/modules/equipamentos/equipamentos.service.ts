import { randomInt } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { requireExpectedVersion } from "../../shared/version.js";
import { EquipamentosRepository } from "./equipamentos.repository.js";
const states = ["NOVO", "BOM_ESTADO", "USADO_LEVE", "USADO_MODERADO", "DANIFICADO_LEVE", "DANIFICADO_GRAVE", "INSERVIVEL"];
const tracking = new Map<string, string[]>([["AGUARDANDO_TRIAGEM", []], ["EM_TRIAGEM", []], ["AGUARDANDO_DESMONTE", ["EM_DESMONTE"]], ["EM_DESMONTE", ["PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"]], ["PECAS_REAPROVEITADAS", ["BAIXA_DEFINITIVA"]], ["MATERIAL_RECICLAVEL", ["BAIXA_DEFINITIVA"]], ["DESCARTE_SEGURO", ["BAIXA_DEFINITIVA"]], ["BAIXA_DEFINITIVA", []]]);
const view = (row: any) => row ? ({ ...row, quantidadeMovimentacoes: row._count?.movimentacoes ?? 0, _count: undefined }) : row;
function decimal(value: string | number, name: string, places: number, max: number) { const str = String(value); const number = Number(str); if (!Number.isFinite(number) || number < 0 || number > max || !new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(str)) throw errors.badRequest("VALIDATION_ERROR", `${name} deve ser não negativo com até ${places} casas decimais.`); return number.toFixed(places); }
export class EquipamentosService {
  constructor(private readonly repo: EquipamentosRepository) {}
  async list(q: { page?: number; pageSize?: number; q?: string; loteId?: string; tipo?: string; estadoFisico?: string; statusRastreamento?: string; ativo?: boolean }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); const page = Math.max(1, Math.trunc(q.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(q.pageSize ?? 20))); const [rows, total] = await this.repo.list({ ...q, page, pageSize }); return { data: rows.map(view), meta: pageMeta(page, pageSize, total) }; }
  async get(id: string, actorRole: string) { assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); const row = await this.repo.findById(id); if (!row) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); return view(row); }
  async create(input: { loteId: string; tipo: string; marca: string; modelo: string; anoFabricacao: number; estadoFisico: string; pesoQuilogramas: string | number; valorAquisicao?: string | number }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    const year = new Date().getUTCFullYear(); if (!input.marca.trim() || !input.modelo.trim() || !Number.isInteger(input.anoFabricacao) || input.anoFabricacao < 1900 || input.anoFabricacao > year || !states.includes(input.estadoFisico)) throw errors.badRequest("VALIDATION_ERROR", "Atributos do equipamento inválidos.");
    const peso = decimal(input.pesoQuilogramas, "Peso", 3, 99999999.999); const valor = decimal(input.valorAquisicao ?? 0, "Valor de aquisição", 2, 9999999999.99);
    const prefix = input.tipo.replace(/[^A-Z]/g, "").slice(0, 4).padEnd(4, "X");
    try { return await this.repo.transaction(async tx => { const lot = await tx.findLot(input.loteId); if (!lot) throw errors.notFound("LOT_NOT_FOUND", "Lote não encontrado."); if (!lot.ativo || lot.statusProcessamento !== "RECEBIDO") throw errors.conflict("LOT_NOT_RECEIVING_EQUIPMENT", "Equipamentos só podem ser vinculados a lote ativo no estado RECEBIDO."); const posicaoNoLote = await tx.nextPosition(input.loteId); let created: any; for (let tries = 0; tries < 5; tries++) { const code = `GC-${prefix}-${String(randomInt(0, 1000000)).padStart(6, "0")}`; try { created = await tx.create({ codigoBarrasInterno: code, tipo: input.tipo as never, marca: input.marca.trim(), modelo: input.modelo.trim(), anoFabricacao: input.anoFabricacao, estadoFisico: input.estadoFisico as never, pesoQuilogramas: peso, valorAquisicao: valor, loteId: input.loteId, posicaoNoLote, statusRastreamento: "AGUARDANDO_TRIAGEM", ativo: true }); break; } catch (error) { if (!isPrismaCode(error, "P2002") || tries === 4) throw error; } } if (!created) throw errors.conflict("CODE_GENERATION_CONFLICT", "Não foi possível gerar código interno único; tente novamente."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "CRIACAO_EQUIPAMENTO", entidade: "Equipamento", entidadeId: created.id, resultado: "SUCESSO", requestId }); return view(created); }, true); }
    catch (error) { if (isPrismaCode(error, "P2002")) throw errors.conflict("DUPLICATE_CODIGO_BARRAS", "Conflito de unicidade de equipamento ou posição no lote."); if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "Cadastro conflitou com outra operação; tente novamente."); throw error; }
  }
  async update(id: string, input: { versaoEsperada: number; marca?: string; modelo?: string; anoFabricacao?: number; pesoQuilogramas?: string | number; valorAquisicao?: string | number; loteId?: string | null }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    requireExpectedVersion(input.versaoEsperada);

    try {
      return await this.repo.transaction(async tx => {
        const row = await tx.findById(id);
        if (!row) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado.");
        if (row.versao !== input.versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação.");
        if (!row.ativo) throw errors.conflict("EQUIPMENT_INACTIVE", "Equipamento desativado não pode ser atualizado.");

        const data: Prisma.EquipamentoUncheckedUpdateManyInput = { versao: { increment: 1 } };
        if (input.marca !== undefined) {
          if (!input.marca.trim()) throw errors.badRequest("VALIDATION_ERROR", "Marca não pode ficar vazia.");
          data.marca = input.marca.trim();
        }
        if (input.modelo !== undefined) {
          if (!input.modelo.trim()) throw errors.badRequest("VALIDATION_ERROR", "Modelo não pode ficar vazio.");
          data.modelo = input.modelo.trim();
        }
        if (input.anoFabricacao !== undefined) {
          const y = new Date().getUTCFullYear();
          if (!Number.isInteger(input.anoFabricacao) || input.anoFabricacao < 1900 || input.anoFabricacao > y) throw errors.badRequest("VALIDATION_ERROR", "Ano de fabricação inválido.");
          data.anoFabricacao = input.anoFabricacao;
        }
        if (input.pesoQuilogramas !== undefined) data.pesoQuilogramas = decimal(input.pesoQuilogramas, "Peso", 3, 99999999.999);
        if (input.valorAquisicao !== undefined) data.valorAquisicao = decimal(input.valorAquisicao, "Valor de aquisição", 2, 9999999999.99);

        const requestedLotChange = input.loteId !== undefined && input.loteId !== row.loteId;
        const unlinking = requestedLotChange && input.loteId === null;
        if (requestedLotChange) {
          if (row.statusRastreamento !== "AGUARDANDO_TRIAGEM" || row._count.movimentacoes > 0) {
            throw errors.conflict(
              unlinking ? "EQUIPMENT_CANNOT_UNLINK_LOT" : "EQUIPMENT_CANNOT_MOVE_LOT",
              "O vínculo com o lote só pode ser alterado antes do início do processamento e sem movimentações registradas.",
            );
          }
          if (unlinking) {
            data.loteId = null;
            data.posicaoNoLote = null;
          } else {
            const destination = await tx.findLot(input.loteId as string);
            if (!destination || !destination.ativo || destination.statusProcessamento !== "RECEBIDO") {
              throw errors.conflict("LOT_NOT_RECEIVING_EQUIPMENT", "Lote de destino não está recebendo equipamentos.");
            }
            data.loteId = input.loteId as string;
            data.posicaoNoLote = await tx.nextPosition(input.loteId as string);
          }
        }

        const hasEditableFields = input.marca !== undefined || input.modelo !== undefined || input.anoFabricacao !== undefined || input.pesoQuilogramas !== undefined || input.valorAquisicao !== undefined || requestedLotChange;
        if (!hasEditableFields) throw errors.badRequest("VALIDATION_ERROR", "Informe ao menos um atributo para atualização.");

        const updated = await tx.updateVersioned(id, input.versaoEsperada, data);
        if (!updated) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação.");
        const actor = await tx.actorName(actorId);
        await tx.recordAudit({
          atorUsuarioId: actorId,
          atorNomeSnapshot: actor?.nome,
          acao: unlinking ? "DESVINCULACAO_EQUIPAMENTO" : "ATUALIZACAO_EQUIPAMENTO",
          entidade: "Equipamento",
          entidadeId: id,
          resultado: "SUCESSO",
          requestId,
          ...(requestedLotChange ? { detalhes: { loteAnteriorId: row.loteId, loteNovoId: input.loteId ?? null, posicaoAnterior: row.posicaoNoLote, posicaoNova: input.loteId === null ? null : data.posicaoNoLote } } : {}),
        });
        return view(updated);
      }, true);
    } catch (error) {
      if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "A operação conflitou com uma alteração concorrente.");
      throw error;
    }
  }
  async changePhysicalState(id: string, input: { versaoEsperada: number; estadoFisico: string; justificativa?: string }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    requireExpectedVersion(input.versaoEsperada);
    const row = await this.repo.findById(id); if (!row) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); if (row.versao !== input.versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); if (!row.ativo) throw errors.conflict("EQUIPMENT_INACTIVE", "Equipamento inativo não pode ser atualizado."); const current = states.indexOf(row.estadoFisico); const target = states.indexOf(input.estadoFisico); if (target < 0) throw errors.badRequest("VALIDATION_ERROR", "Estado físico inválido."); if (current === target) throw errors.conflict("NO_STATE_CHANGE", "O estado físico informado é igual ao estado atual."); if (target - current >= 2 && !input.justificativa?.trim()) throw errors.badRequest("JUSTIFICATION_REQUIRED", "Mudança que degrada duas ou mais categorias exige justificativa.");
    return this.repo.transaction(async tx => { const updated = await tx.updateVersioned(id, input.versaoEsperada, { estadoFisico: input.estadoFisico as never, versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ALTERACAO_ESTADO_FISICO", entidade: "Equipamento", entidadeId: id, resultado: "SUCESSO", requestId, detalhes: { de: row.estadoFisico, para: input.estadoFisico, justificativa: input.justificativa?.trim() ?? null } }); return view(updated); }, true);
  }
  async changeTrackingStatus(id: string, input: { versaoEsperada: number; statusRastreamento: string; justificativa: string }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]);
    const row = await this.repo.findById(id); if (!row) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); if (!row.ativo) throw errors.conflict("EQUIPMENT_INACTIVE", "Equipamento inativo não pode ser atualizado."); if (row.versao !== input.versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); if (!input.justificativa.trim()) throw errors.badRequest("JUSTIFICATION_REQUIRED", "Justificativa é obrigatória."); if (!tracking.get(row.statusRastreamento)?.includes(input.statusRastreamento)) throw errors.conflict("INVALID_STATE_TRANSITION", "Transição de rastreamento inválida.");
    return this.repo.transaction(async tx => { const updated = await tx.updateVersioned(id, input.versaoEsperada, { statusRastreamento: input.statusRastreamento as never, versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ALTERACAO_STATUS_RASTREAMENTO", entidade: "Equipamento", entidadeId: id, resultado: "SUCESSO", requestId, detalhes: { de: row.statusRastreamento, para: input.statusRastreamento, justificativa: input.justificativa.trim() } }); return view(updated); }, true);
  }
  async activeChange(id: string, activate: boolean, version: number, actorId: string, requestId: string, actorRole: string) { assertRole(actorRole, ["ADMINISTRADOR", "GESTOR_ALMOXARIFADO"]); requireExpectedVersion(version); return this.repo.transaction(async tx => { const row = await tx.findById(id); if (!row) throw errors.notFound("EQUIPMENT_NOT_FOUND", "Equipamento não encontrado."); if (row.versao !== version) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); if (row.ativo === activate) throw errors.conflict(activate ? "EQUIPMENT_ALREADY_ACTIVE" : "EQUIPMENT_ALREADY_INACTIVE", activate ? "Equipamento já está ativo." : "Equipamento já está desativado."); const updated = await tx.updateVersioned(id, version, { ativo: activate, versao: { increment: 1 } }); if (!updated) throw errors.conflict("VERSION_CONFLICT", "Equipamento alterado por outra operação."); const actor = await tx.actorName(actorId); await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: activate ? "REATIVACAO_EQUIPAMENTO" : "DESATIVACAO_EQUIPAMENTO", entidade: "Equipamento", entidadeId: id, resultado: "SUCESSO", requestId }); return view(updated); }, true); }
}
