# 03 — Modelo de dados

## 1. Convenções gerais

- IDs técnicos: UUID gerado no servidor.
- Datas/horas persistidas como `DateTime` com fuso (`timestamptz`) e tratadas em UTC.
- Dinheiro: `Decimal(12,2)`; peso: `Decimal(10,3)` em quilogramas.
- Recursos mutáveis têm `versao` iniciando em 1 e timestamps `createdAt`/`updatedAt` quando aplicável.
- `senhaHash` nunca é retornado pela API.
- Chaves estrangeiras de entidades com histórico usam restrição de exclusão (`Restrict`); o fluxo de negócio usa desativação/cancelamento.

## 2. Entidades

### `Usuario`

Campos: `id`, `usuario` (único e normalizado), `nome`, `senhaHash`, `papel`, `ativo`, `ultimoAcesso`, `createdAt`, `updatedAt`, `versao`.

Papel é enum de valor único. Senhas novas usam bcrypt. Desativação impede login e invalida os tokens conhecidos do usuário.

### `TokenRevogado`

Campos: `jti` único/PK, `usuarioId`, `expiraEm`, `revogadoEm`.

Mantém revogação individual do JWT. O registro não deve ser removido antes da expiração do token correspondente.

### `Organizacao`

Campos: `id`, `razaoSocial`, `cnpj` (14 dígitos normalizados e único), `inscricaoEstadual?`, `enderecoCompleto?`, `telefone?`, `email?`, `dataCadastro`, `ativo`, `createdAt`, `updatedAt`, `versao`.

Razão social e CNPJ são obrigatórios; endereço é um texto único. Uma organização tem zero ou vários contratos históricos e zero ou vários lotes.

### `Contrato`

Campos: `id`, `organizacaoId`, `dataAssinatura`, `dataVencimento`, `clausulas` (lista ordenada de strings), `valorMensal Decimal(12,2)`, `renovacaoAutomatica`, `ativo`, `dataCancelamento?`, `createdAt`, `updatedAt`, `versao`.

A relação é `Organizacao 1:N Contrato`, divergindo deliberadamente da simplificação do PDF para preservar o histórico da AV1. O status exposto pela API é derivado: `CANCELADO` quando `ativo=false` ou `dataCancelamento` estiver preenchida; `VENCIDO` quando não cancelado e `dataVencimento` não for futura; `VIGENTE` quando ativo, sem cancelamento e com vencimento futuro. A regra de no máximo um contrato vigente é validada no serviço/transação.

**Renovação:** encerra o contrato vigente anterior e cria um novo registro em uma transação, preservando o anterior. O evento de auditoria deve permitir entender que o encerramento ocorreu por renovação. `renovacaoAutomatica` é um dado contratual, não um job automático nesta AV2.

### `Lote`

Campos: `id`, `organizacaoId`, `dataEntrada`, `notaFiscal`, `transportadora`, `statusProcessamento`, `observacoes`, `ativo`, `createdAt`, `updatedAt`, `versao`.

Pertence a uma organização. Nota fiscal e transportadora são texto; não há unicidade adicional para nota fiscal definida neste escopo.

### `Equipamento`

Campos: `id`, `codigoBarrasInterno` único, `tipo`, `marca`, `modelo`, `anoFabricacao`, `estadoFisico`, `pesoQuilogramas Decimal(10,3)`, `loteId`, `posicaoNoLote`, `statusRastreamento`, `ativo`, `valorAquisicao Decimal(12,2)`, `createdAt`, `updatedAt`, `versao`.

O código é gerado no servidor e deve ser globalmente único. Posições no mesmo lote são únicas e ordenáveis.

**Alinhamento técnico pendente:** a regra aprovada permite desvincular um equipamento de um lote antes do início do processamento/rastreabilidade; o schema Prisma inicial ainda declara `loteId` obrigatório. Antes de aplicar a migração, alinhar schema e regra (por exemplo, `loteId` e `posicaoNoLote` anuláveis para equipamentos não vinculados), mantendo o vínculo obrigatório para cadastro operacional normal e verificando o comportamento de índices únicos.

### `Movimentacao`

Campos: `id`, `equipamentoId`, `dataHora`, `origem`, `destino`, `responsavelId`, `responsavelNomeSnapshot`, `observacao`.

Registro append-only; equipamento e responsável são FKs. `dataHora`, responsável e origem são definidos pelo servidor; destino e observação são informados pelo usuário autorizado.

### `EventoAuditoria`

Campos: `id`, `atorUsuarioId?`, `atorNomeSnapshot?`, `acao`, `entidade`, `entidadeId`, `instante`, `resultado`, `requestId?`, `detalhes?` JSON.

Não registrar senhas, hashes, JWT, segredos, connection strings ou outros dados de autenticação. Eventos não são editáveis por endpoints de negócio.

### `ParametroGlobal`

Registro singleton de ID `global`; `aliquotaImpostoPercentual Decimal(5,2)` padrão `0.00`; `taxaDepreciacaoAnualPercentual Decimal(5,2)` padrão `15.00`; `atualizadoPorId?`, timestamps.

Somente Administrador pode alterar os parâmetros. Valores são percentuais entre 0 e 100 e alterações são auditadas.

## 3. Relacionamentos

```text
Usuario 1 ─── N TokenRevogado
Usuario 1 ─── N Movimentacao (responsável)
Usuario 1 ─── N EventoAuditoria (ator, opcional)
Usuario 1 ─── N ParametroGlobal (autor de atualização, opcional)
Organizacao 1 ─── N Contrato
Organizacao 1 ─── N Lote
Lote 1 ─── N Equipamento (o vínculo pode ser removido somente no estágio permitido)
Equipamento 1 ─── N Movimentacao
```

## 4. Enums herdados da AV1

### `PapelUsuario`
`ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`.

### `TipoEquipamento`
`COMPUTADOR_MESA`, `NOTEBOOK`, `MONITOR`, `IMPRESSORA`, `SERVIDOR`, `ROTEADOR`, `CABO_ESTRUTURADO`, `FONTE_ALIMENTACAO`.

### `EstadoFisico` — ordem usada para medir degradação
`NOVO` → `BOM_ESTADO` → `USADO_LEVE` → `USADO_MODERADO` → `DANIFICADO_LEVE` → `DANIFICADO_GRAVE` → `INSERVIVEL`.

### `StatusRastreamento`
`AGUARDANDO_TRIAGEM`, `EM_TRIAGEM`, `AGUARDANDO_DESMONTE`, `EM_DESMONTE`, `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL`, `DESCARTE_SEGURO`, `BAIXA_DEFINITIVA`.

### `StatusProcessamentoLote`
`RECEBIDO`, `EM_TRIAGEM`, `TRIAGEM_CONCLUIDA`, `ENCAMINHADO`, `FINALIZADO`.

## 5. Índices e integridade

- CNPJ normalizado e único;
- código de barras interno único;
- usuário normalizado único;
- `posicaoNoLote` única dentro de cada lote enquanto vinculada;
- FKs obrigatórias para relações de negócio e de histórico;
- índices por campos usados em filtros (estado ativo, organização/status, datas e histórico do equipamento);
- não usar cascata destrutiva para eliminar contratos, equipamentos, movimentações ou auditoria.
