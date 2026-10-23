import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../shared/domain-error.js";
import { UsuariosService } from "../modules/usuarios/usuarios.service.js";
import { OrganizacoesService } from "../modules/organizacoes/organizacoes.service.js";
import { ContratosService } from "../modules/contratos/contratos.service.js";
import { LotesService } from "../modules/lotes/lotes.service.js";
import { EquipamentosService } from "../modules/equipamentos/equipamentos.service.js";
import { MovimentacoesService } from "../modules/movimentacoes/movimentacoes.service.js";
import { AuditoriaConsultaService } from "../modules/auditoria/auditoria-consulta.service.js";
import { RelatoriosService } from "../modules/relatorios/relatorios.service.js";
import { ParametrosService } from "../modules/parametros/parametros.service.js";

const unusedRepository = {} as never;

test("services de negócio aplicam RBAC mesmo sem passar pelo guard HTTP", async () => {
  const deniedOperations: Array<[string, () => Promise<unknown>]> = [
    ["gestão de usuários", () => new UsuariosService(unusedRepository).list({}, "AUDITOR")],
    ["organizações", () => new OrganizacoesService(unusedRepository).list({}, "AUDITOR")],
    ["contratos", () => new ContratosService(unusedRepository).list({}, "GESTOR_ALMOXARIFADO")],
    ["lotes", () => new LotesService(unusedRepository).list({}, "OPERADOR_CADASTRO")],
    ["equipamentos", () => new EquipamentosService(unusedRepository).list({}, "OPERADOR_CADASTRO")],
    ["criação de movimentação", () => new MovimentacoesService(unusedRepository).create("id", { destino: "destino" }, "id", "req", "AUDITOR")],
    ["leitura de movimentação", () => new MovimentacoesService(unusedRepository).list({}, "OPERADOR_CADASTRO")],
    ["auditoria", () => new AuditoriaConsultaService(unusedRepository).list({}, "OPERADOR_CADASTRO")],
    ["relatórios", () => new RelatoriosService(unusedRepository).operacionais({}, "OPERADOR_CADASTRO")],
    ["parâmetros globais", () => new ParametrosService(unusedRepository).get("AUDITOR")],
  ];

  for (const [name, operation] of deniedOperations) {
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof DomainError, `${name}: erro deve ser DomainError`);
      assert.equal(error.statusCode, 403, `${name}: status esperado é 403`);
      assert.equal(error.code, "FORBIDDEN", `${name}: código esperado é FORBIDDEN`);
      return true;
    });
  }
});
