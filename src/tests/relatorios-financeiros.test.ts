import { test } from "node:test";
import assert from "node:assert/strict";
import { RelatoriosService } from "../modules/relatorios/relatorios.service.js";
import type { RelatoriosRepository } from "../modules/relatorios/relatorios.repository.js";

test("relatório financeiro calcula receita, imposto, valor líquido e depreciação", async () => {
  const ano = new Date().getUTCFullYear();
  const de = new Date(Date.UTC(ano, 0, 1)).toISOString();
  const ate = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999)).toISOString();
  const movimentacaoNoPeriodo = new Date(Date.UTC(ano, 5, 15));
  const movimentacaoForaDoPeriodo = new Date(Date.UTC(ano - 1, 11, 15));

  const repository = {
    parametros: async () => ({
      aliquotaImpostoPercentual: "10.00",
      taxaDepreciacaoAnualPercentual: "15.00",
    }),
    contratosNoPeriodo: async () => [
      { valorMensal: "1000.00" },
      { valorMensal: "250.00" },
    ],
    equipamentosFinanceiros: async () => [
      {
        anoFabricacao: ano,
        valorAquisicao: "1000.00",
        movimentacoes: [],
      },
      {
        anoFabricacao: ano - 2,
        valorAquisicao: "1000.00",
        movimentacoes: [{ dataHora: movimentacaoNoPeriodo }],
      },
      {
        anoFabricacao: ano - 20,
        valorAquisicao: "1000.00",
        movimentacoes: [{ dataHora: movimentacaoNoPeriodo }],
      },
      {
        anoFabricacao: ano,
        valorAquisicao: "5000.00",
        movimentacoes: [{ dataHora: movimentacaoForaDoPeriodo }],
      },
    ],
  } as unknown as RelatoriosRepository;

  const service = new RelatoriosService(repository);
  const resultado = await service.financeiros(
    { de, ate },
    "ADMINISTRADOR",
  );

  assert.equal(resultado.contratosConsiderados, 2);
  assert.equal(resultado.receitaMensalBrutaEstimada, 1250);
  assert.equal(resultado.aliquotaImpostoPercentual, 10);
  assert.equal(resultado.impostosEstimados, 125);
  assert.equal(resultado.receitaLiquidaEstimada, 1125);
  assert.equal(resultado.taxaDepreciacaoAnualPercentual, 15);
  assert.equal(resultado.equipamentosConsiderados, 3);
  assert.equal(resultado.valorResidualEstimadoEquipamentosDoPeriodo, 1700);
});