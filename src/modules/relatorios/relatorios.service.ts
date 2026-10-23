import { errors } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { RelatoriosRepository } from "./relatorios.repository.js";
function date(value: string | undefined) { if (!value) return undefined; const d = new Date(value); if (!Number.isFinite(d.getTime())) throw errors.badRequest("VALIDATION_ERROR", "Data de filtro inválida."); return d; }
function period(input: { de?: string; ate?: string }) { const de = date(input.de) ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)); const ate = date(input.ate) ?? new Date(); if (de > ate) throw errors.badRequest("VALIDATION_ERROR", "de não pode ser posterior a ate."); return { de, ate }; }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export class RelatoriosService {
  constructor(private readonly repo: RelatoriosRepository) {}
  async operacionais(input: { organizacaoId?: string; de?: string; ate?: string; status?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]);
    const { de, ate } = period(input); const lotes = await this.repo.lotes({ organizacaoId: input.organizacaoId, de, ate, status: input.status }); const equipments = await this.repo.equipamentos(lotes.map(l => l.id));
    const totalPeso = equipments.reduce((sum, e) => sum + Number(e.pesoQuilogramas), 0);
    const porStatusLote: Record<string, number> = {}; for (const item of lotes) porStatusLote[item.statusProcessamento] = (porStatusLote[item.statusProcessamento] ?? 0) + 1;
    const porTipo: Record<string, number> = {}; for (const item of equipments) porTipo[item.tipo] = (porTipo[item.tipo] ?? 0) + 1;
    return { periodo: { de: de.toISOString(), ate: ate.toISOString() }, organizacaoId: input.organizacaoId ?? null, totalLotes: lotes.length, totalEquipamentos: equipments.length, pesoTotalQuilogramas: Math.round(totalPeso * 1000) / 1000, porStatusLote, porTipo };
  }
  async triagem(input: { organizacaoId?: string; de?: string; ate?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]);
    const { de, ate } = period(input); const lotes = await this.repo.lotes({ organizacaoId: input.organizacaoId, de, ate }); const equipments = await this.repo.equipamentos(lotes.map(l => l.id));
    const lotStatuses: Record<string, number> = {}; for (const item of lotes) lotStatuses[item.statusProcessamento] = (lotStatuses[item.statusProcessamento] ?? 0) + 1;
    const trackingStatuses: Record<string, number> = {}; for (const item of equipments) trackingStatuses[item.statusRastreamento] = (trackingStatuses[item.statusRastreamento] ?? 0) + 1;
    return { periodo: { de: de.toISOString(), ate: ate.toISOString() }, totalLotes: lotes.length, totalEquipamentos: equipments.length, lotesPorStatus: lotStatuses, equipamentosPorStatusRastreamento: trackingStatuses };
  }
  async financeiros(input: { de?: string; ate?: string }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR", "AUDITOR"]);
    const { de, ate } = period(input);
    const [params, contracts, allEquipments] = await Promise.all([
      this.repo.parametros(), this.repo.contratosNoPeriodo(de, ate), this.repo.equipamentosFinanceiros(),
    ]);
    const equipments = allEquipments.filter(e => {
      // Regra aprovada: a última movimentação define o período do equipamento;
      // sem movimentação, a data de referência é o início do período consultado.
      const referenceDate: Date = e.movimentacoes[0]?.dataHora ?? de;
      return referenceDate >= de && referenceDate <= ate;
    });
    const bruto = contracts.reduce((sum, c) => sum + Number(c.valorMensal), 0);
    const aliquota = Number(params?.aliquotaImpostoPercentual ?? 0);
    const taxa = Number(params?.taxaDepreciacaoAnualPercentual ?? 15);
    const imposto = roundMoney(bruto * aliquota / 100);
    const liquido = roundMoney(bruto - imposto);
    const anoAtual = new Date().getUTCFullYear();
    const valorResidualEstimado = roundMoney(equipments.reduce((sum, e) => {
      const idade = Math.max(0, anoAtual - e.anoFabricacao);
      const fator = Math.max(0, 1 - taxa / 100 * idade);
      return sum + roundMoney(Number(e.valorAquisicao) * fator);
    }, 0));
    return {
      periodo: { de: de.toISOString(), ate: ate.toISOString() },
      contratosConsiderados: contracts.length,
      receitaMensalBrutaEstimada: roundMoney(bruto),
      aliquotaImpostoPercentual: aliquota,
      impostosEstimados: imposto,
      receitaLiquidaEstimada: liquido,
      taxaDepreciacaoAnualPercentual: taxa,
      equipamentosConsiderados: equipments.length,
      valorResidualEstimadoEquipamentosDoPeriodo: valorResidualEstimado,
      observacao: "Estimativa financeira simplificada: soma dos valores mensais dos contratos cuja assinatura/vigência cruza o período e que não estavam cancelados antes do início; equipamentos filtrados pela última movimentação, ou pelo início do período quando não possuem movimentação. Não representa contabilização fiscal nem rateio proporcional por dias.",
    };
  }
}
