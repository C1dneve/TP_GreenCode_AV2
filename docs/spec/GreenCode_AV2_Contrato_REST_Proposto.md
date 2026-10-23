> **Nota de estado (20/10/2026):** as decisões de domínio foram aprovadas e consolidadas em `docs/adr/ADR-0002-decisoes-dominio.md`. Este contrato continua sendo uma proposta de referência de endpoints e precisa ser alinhado ao OpenAPI e aos endpoints efetivamente implementados. Em caso de conflito, prevalecem as decisões aprovadas no ADR e os contratos testados.

# GreenCode AV2 — Contrato REST proposto

**Status:** proposta consolidada com as escolhas REST R1–R12 recebidas em 20/10/2026; ainda não é um OpenAPI definitivo nem autoriza iniciar o schema Prisma sem fechar as decisões de domínio pendentes.  
**Repositório:** `TP_GreenCode_AV2` · **branch de trabalho:** `feature/av2-monolith`  
**Stack de referência:** Node.js + TypeScript + Fastify + Prisma + PostgreSQL.

## 1. Decisões aprovadas

| Item | Decisão adotada |
|---|---|
| R1 — Prefixo/versionamento | Todas as rotas de negócio sob `/api/v1`. |
| R2 — Recursos | Recursos plurais em português, por exemplo `organizacoes`, `contratos`, `lotes`, `equipamentos` e `movimentacoes`. |
| R3 — IDs | UUID como identificador técnico de recursos. CNPJ, login e código de barras interno são identificadores de negócio, não chaves primárias. |
| R4 — Respostas | Recurso individual como objeto JSON direto; coleções paginadas no formato `{ "data": [...], "meta": {...} }`. |
| R5 — Erros | `{ "error": { "code", "message", "details?", "requestId?" } }`. |
| R6 — Paginação | `page`, `pageSize`, `sortBy`, `sortOrder`, com limites definidos neste documento. |
| R7 — Filtros | Filtros iniciais por entidade conforme a seção 5. |
| R8 — Contratos | Modelo híbrido: operações contextuais aninhadas sob organização; operações por ID em `/contratos/:contratoId`. |
| R9 — Estado/ciclo de vida | `PATCH` para atributos editáveis e `POST` em subrotas explícitas para transições críticas. |
| R10 — Exclusão | Não usar `DELETE` para apagar fisicamente registros de negócio com histórico; usar ações de desativação, reativação e cancelamento. |
| R11 — Autenticação | `/auth/login`, `/auth/logout`, `/auth/me` e `/auth/change-password`. Logout revoga imediatamente o JWT atual pela persistência do `jti`. |
| R12 — HTTP | Matriz da seção 7; `409` para conflito de unicidade, regra de negócio, estado e concorrência. Erros de entrada usam `400` no escopo inicial; `422` não será usado inicialmente. |

## 2. Convenções gerais

- Base local sugerida: `http://localhost:3000`; prefixo de recursos: `/api/v1`.
- Corpo e resposta de negócio em `application/json; charset=utf-8`.
- Nomes de propriedades em `camelCase`, mantendo termos do domínio da AV1 quando aplicável (`razaoSocial`, `dataEntrada`, `statusProcessamento`, `codigoBarrasInterno`).
- IDs de recursos: UUID gerado pelo servidor. Um UUID sintaticamente inválido em um parâmetro de rota resulta em `400`; UUID válido sem recurso correspondente resulta em `404`.
- Rotas protegidas exigem `Authorization: Bearer <token>`. Exceções públicas: `GET /health`, `GET /docs`, `GET /docs/json` e `POST /api/v1/auth/login`.
- JWT com validade de 30 minutos, verificação do usuário ativo a cada requisição protegida e rejeição de tokens revogados, expirados ou inválidos. O logout revoga apenas o token atual identificado por `jti`.
- Não retornar hash de senha, salt, token de revogação, segredos, nem propriedades internas de autenticação.
- Não aceitar do cliente campos derivados ou controlados pelo servidor, como IDs gerados, `dataCadastro` quando definida automaticamente, ator de movimentação e `dataHora` da movimentação.
- Datas e horários trafegam em ISO 8601; horários persistidos são tratados em UTC. Exemplo: `2026-10-20T12:30:00.000Z`.
- Valores monetários: a proposta usa strings decimais como `"1250.00"` no JSON para evitar ambiguidade de ponto flutuante. A confirmação final de escala e tipo Prisma permanece vinculada à decisão ER12.
- Entidades mutáveis retornam `versao` numérica. Requisições que alterem entidade mutável devem informar `versaoEsperada`; se o estado persistido já mudou, responder `409 VERSION_CONFLICT`. O campo `versao` é controlado pelo servidor e não pode ser definido diretamente.
- Toda operação de escrita deve validar autenticação, RBAC, schema da entrada e regras de domínio na camada de serviço. Controllers não devem chamar Prisma diretamente.

### 2.1 Recurso individual e coleção paginada

Resposta de item: objeto diretamente, sem `data` ou `success` externo.

```json
{
  "id": "c391f3a7-59fb-460e-94ef-2af2872850d1",
  "razaoSocial": "Organização Exemplo Ltda.",
  "cnpj": "12345678000195",
  "ativo": true,
  "versao": 1
}
```

Resposta de coleção:

```json
{
  "data": [
    {
      "id": "c391f3a7-59fb-460e-94ef-2af2872850d1",
      "razaoSocial": "Organização Exemplo Ltda.",
      "cnpj": "12345678000195",
      "ativo": true,
      "versao": 1
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "sortBy": "razaoSocial",
    "sortOrder": "asc"
  }
}
```

`totalPages` vale `0` quando `totalItems` é `0`. A ordem padrão, quando não informada, deve ser determinística (preferencialmente por `id` ou campo principal mais `id` como desempate).

### 2.2 Erros

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A requisição contém campos inválidos.",
    "details": [
      { "field": "cnpj", "reason": "INVALID_CHECK_DIGITS" }
    ],
    "requestId": "req-01JABCDEF123"
  }
}
```

- `code`: código estável para consumidores e testes.
- `message`: explicação legível, sem stack trace nem dados secretos.
- `details`: opcional; estrutura específica por erro, sem incluir dados sensíveis.
- `requestId`: opcional na forma, mas recomendado em erros e logs para correlação.

Códigos propostos: `VALIDATION_ERROR`, `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `TOKEN_REVOKED`, `USER_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_CNPJ`, `DUPLICATE_CODIGO_BARRAS`, `DUPLICATE_LOGIN`, `BUSINESS_RULE_CONFLICT`, `INVALID_STATE_TRANSITION`, `VERSION_CONFLICT` e `INTERNAL_ERROR`.

## 3. Catálogo de endpoints

Todas as rotas abaixo, exceto as expressamente marcadas como públicas, exigem JWT e a permissão definida pela matriz RBAC já aprovada para os quatro papéis (`ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`). Este catálogo não altera essa matriz. O papel do token não deve ser a única fonte de autorização: o servidor também verifica se o usuário continua ativo e se o token não foi revogado.

### 3.1 Saúde e documentação

| Método | Rota | Acesso | Resultado |
|---|---|---|---|
| `GET` | `/health` | Público | `200` com estado de saúde mínimo. |
| `GET` | `/docs` | Público | Interface Swagger/OpenAPI. |
| `GET` | `/docs/json` | Público | Documento OpenAPI em JSON. |

### 3.2 Autenticação e conta

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Autenticar login e senha e emitir JWT. | `200` |
| `POST` | `/api/v1/auth/logout` | Revogar o token Bearer atual pelo `jti`. | `204` |
| `GET` | `/api/v1/auth/me` | Retornar os dados públicos do usuário autenticado. | `200` |
| `POST` | `/api/v1/auth/change-password` | Alterar a própria senha após validar a senha atual. | `204` |

Contrato proposto de login:

```json
{
  "usuario": "operador.exemplo",
  "senha": "senha-fornecida-no-ambiente-de-teste"
}
```

Resposta de login — token é retornado uma vez e nunca persistido em texto claro:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 1800,
  "user": {
    "id": "c391f3a7-59fb-460e-94ef-2af2872850d1",
    "usuario": "operador.exemplo",
    "nome": "Operador Exemplo",
    "papel": "OPERADOR_CADASTRO",
    "ativo": true
  }
}
```

`change-password` recebe `{ "senhaAtual": "...", "novaSenha": "..." }`. Política mínima de força/tamanho da senha deverá ser fixada na implementação e documentada. Para logout bem-sucedido, o token atual passa a ser recusado imediatamente; um segundo logout do mesmo token pode responder `204` de forma idempotente.

### 3.3 Usuários (administração)

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/usuarios` | Listar usuários com paginação. | `200` |
| `POST` | `/api/v1/usuarios` | Criar usuário. | `201` + `Location` |
| `GET` | `/api/v1/usuarios/:usuarioId` | Consultar usuário. | `200` |
| `PATCH` | `/api/v1/usuarios/:usuarioId` | Atualizar nome e/ou papel e campos permitidos. | `200` |
| `POST` | `/api/v1/usuarios/:usuarioId/desativacao` | Desativar usuário e invalidar acessos ativos. | `200` |
| `POST` | `/api/v1/usuarios/:usuarioId/reativacao` | Reativar usuário. | `200` |
| `POST` | `/api/v1/usuarios/:usuarioId/redefinicao-senha` | Administrador iniciar redefinição de senha segundo a política do projeto. | `204` ou `200`, a confirmar na implementação |

A criação aceita `usuario`, `nome`, `papel` e senha inicial/fluxo de definição de senha ainda a fixar. O login deve ser único após normalização de caixa/espaços. Nenhuma resposta inclui hash. Não permitir que uma operação desative o próprio usuário nem o último Administrador ativo; conflito: `409`.

### 3.4 Organizações

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/organizacoes` | Listar, pesquisar e filtrar organizações. | `200` paginado |
| `POST` | `/api/v1/organizacoes` | Criar organização. | `201` + `Location` |
| `GET` | `/api/v1/organizacoes/:organizacaoId` | Consultar organização. | `200` |
| `PATCH` | `/api/v1/organizacoes/:organizacaoId` | Atualizar campos editáveis. | `200` |
| `POST` | `/api/v1/organizacoes/:organizacaoId/desativacao` | Desativar sem apagar histórico. | `200` |
| `POST` | `/api/v1/organizacoes/:organizacaoId/reativacao` | Reativar organização. | `200` |

Campos de domínio derivados do modelo AV1: `razaoSocial`, `cnpj`, `inscricaoEstadual`, `enderecoCompleto`, `telefone`, `email`, `dataCadastro` e `ativo`. `id`, `dataCadastro` e `versao` são controlados pelo servidor. CNPJ é validado por dígitos verificadores e unicidade. A regra herdada da AV1 permanece: a desativação conflita com lotes não finalizados; responder `409` com detalhes da regra, sem ocultar quantos registros bloqueiam a operação caso esse dado seja permitido ao papel.

Não incluir todos os contratos como array expandido por padrão na resposta da organização. Retornar `contratoVigenteId` (ou `null`) e consultar histórico pelas rotas de contratos. A escolha entre `contratoVigenteId` e objeto resumido `contratoVigente` deve ser uniformizada quando ER3 for fechado.

### 3.5 Contratos e histórico contratual

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/organizacoes/:organizacaoId/contratos` | Listar histórico contratual daquela organização, paginado. | `200` paginado |
| `POST` | `/api/v1/organizacoes/:organizacaoId/contratos` | Criar contrato no contexto da organização. | `201` + `Location` |
| `GET` | `/api/v1/organizacoes/:organizacaoId/contratos/:contratoId` | Consultar contrato e validar pertencimento à organização. | `200` |
| `GET` | `/api/v1/contratos` | Listar/filtrar contratos independentemente. | `200` paginado |
| `GET` | `/api/v1/contratos/:contratoId` | Consultar contrato por ID. | `200` |
| `PATCH` | `/api/v1/contratos/:contratoId` | Atualizar campos permitidos de contrato não cancelado. | `200` |
| `POST` | `/api/v1/contratos/:contratoId/renovacao` | Renovar contrato. | `200` |
| `POST` | `/api/v1/contratos/:contratoId/cancelamento` | Cancelar contrato e preservar histórico. | `200` |

Campos base do modelo de referência: `organizacaoId`, `dataAssinatura`, `dataVencimento`, `clausulas`, `valorMensal`, `renovacaoAutomatica`, `ativo` e `dataCancelamento`. A representação definitiva de `status` (vigente/vencido/cancelado) depende da decisão ER3. A regra já aprovada é `Organizacao 1:N Contrato`, com vários contratos históricos e no máximo um contrato vigente por organização.

Regras de contrato propostas:

- Criar contrato para organização desativada: `409`.
- Criar novo contrato quando já houver outro contrato vigente: `409`.
- `dataVencimento` deve ser futura no momento da criação; renovação deve estender a vigência para uma data posterior à atual, sujeito a confirmação da regra ER3.
- Contrato cancelado não pode ser editado nem renovado; cancelar novamente pode responder `409` ou `200` idempotente, a fixar nos testes.
- A rota aninhada para detalhe confirma que o contrato pertence à organização informada; se não pertencer, responder `404` para não revelar associações indevidas.

Exemplo de criação:

```json
{
  "dataVencimento": "2027-10-20T00:00:00.000Z",
  "valorMensal": "1250.00",
  "clausulas": ["Cláusula A", "Cláusula B"],
  "renovacaoAutomatica": false
}
```

### 3.6 Lotes

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/lotes` | Listar e filtrar lotes. | `200` paginado |
| `POST` | `/api/v1/lotes` | Criar lote associado a uma organização. | `201` + `Location` |
| `GET` | `/api/v1/lotes/:loteId` | Consultar lote e totais resumidos. | `200` |
| `PATCH` | `/api/v1/lotes/:loteId` | Atualizar atributos editáveis, não transições críticas. | `200` |
| `POST` | `/api/v1/lotes/:loteId/inicio-triagem` | Iniciar a etapa de triagem. | `200` |
| `POST` | `/api/v1/lotes/:loteId/triagem` | Registrar/confirmar a triagem do lote conforme regras a fechar. | `200` |
| `POST` | `/api/v1/lotes/:loteId/encaminhamento` | Encaminhar lote após pré-condições satisfeitas. | `200` |
| `POST` | `/api/v1/lotes/:loteId/finalizacao` | Finalizar lote após pré-condições satisfeitas. | `200` |
| `POST` | `/api/v1/lotes/:loteId/desativacao` | Desativar lote, se permitido pelas regras de domínio. | `200` |
| `POST` | `/api/v1/lotes/:loteId/reativacao` | Reativar lote. | `200` |
| `GET` | `/api/v1/lotes/:loteId/equipamentos` | Listar equipamentos do lote, paginado. | `200` paginado |

Campos-base: `dataEntrada`, `organizacaoId`, `notaFiscal`, `transportadora`, `statusProcessamento`, `observacoes`, `ativo` e `versao`; os totais `quantidadeEquipamentos` e `pesoTotalQuilogramas` podem ser retornados como campos calculados, não gravados como fonte de verdade.

Estados de referência da AV1: `RECEBIDO`, `EM_TRIAGEM`, `TRIAGEM_CONCLUIDA`, `ENCAMINHADO` e `FINALIZADO`. O serviço deve impedir saltos de estado inválidos e devolver `409 INVALID_STATE_TRANSITION`. A semântica exata de `/triagem` — lote completo ou itens enviados individualmente — e as pré-condições para finalizar ainda dependem das respostas às perguntas de domínio; por isso, o schema do corpo dessas ações permanece provisório.

A regra da AV1 de data de entrada (não futura e não mais antiga que 90 dias) deve ser confirmada antes de ser considerada obrigatória na AV2. Não inventar exceções ou permissões por rota fora da matriz RBAC aprovada.

### 3.7 Equipamentos

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/equipamentos` | Listar, pesquisar e filtrar equipamentos. | `200` paginado |
| `POST` | `/api/v1/equipamentos` | Criar equipamento vinculado a um lote. | `201` + `Location` |
| `GET` | `/api/v1/equipamentos/:equipamentoId` | Consultar equipamento, sem embutir todo o histórico. | `200` |
| `PATCH` | `/api/v1/equipamentos/:equipamentoId` | Atualizar atributos editáveis. | `200` |
| `POST` | `/api/v1/equipamentos/:equipamentoId/estado-fisico` | Alterar estado físico com motivo quando a regra exigir. | `200` |
| `POST` | `/api/v1/equipamentos/:equipamentoId/status-rastreamento` | Alterar status de rastreamento com justificativa. | `200` |
| `POST` | `/api/v1/equipamentos/:equipamentoId/desativacao` | Desativar preservando movimentações. | `200` |
| `POST` | `/api/v1/equipamentos/:equipamentoId/reativacao` | Reativar equipamento. | `200` |
| `GET` | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Consultar histórico cronológico do equipamento. | `200` paginado |
| `POST` | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Registrar movimentação associada ao equipamento. | `201` + `Location` |

Campos-base do modelo AV1: `codigoBarrasInterno`, `tipo`, `marca`, `modelo`, `anoFabricacao`, `estadoFisico`, `pesoQuilogramas`, `loteId`, `posicaoNoLote`, `statusRastreamento`, `ativo` e `valorAquisicao`. `id`, `versao`, histórico e campos derivados são controlados pelo servidor.

Enums conhecidos da AV1 para preservar compatibilidade de domínio:

- `tipo`: `COMPUTADOR_MESA`, `NOTEBOOK`, `MONITOR`, `IMPRESSORA`, `SERVIDOR`, `ROTEADOR`, `CABO_ESTRUTURADO`, `FONTE_ALIMENTACAO`.
- `estadoFisico`: `NOVO`, `BOM_ESTADO`, `USADO_LEVE`, `USADO_MODERADO`, `DANIFICADO_LEVE`, `DANIFICADO_GRAVE`, `INSERVIVEL`.
- `statusRastreamento`: `AGUARDANDO_TRIAGEM`, `EM_TRIAGEM`, `AGUARDANDO_DESMONTE`, `EM_DESMONTE`, `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL`, `DESCARTE_SEGURO`, `BAIXA_DEFINITIVA`.

Regras propostas: `codigoBarrasInterno` único; equipamento vinculado a lote existente; valor de aquisição não negativo; mudança para `EM_DESMONTE` somente depois da triagem exigida; toda mudança de status exige justificativa conforme regra AV1; queda de pelo menos duas categorias de estado físico exige justificativa. A ordem das categorias deve ficar explícita nos testes e na documentação, após confirmação da regra de domínio.

Exemplo de atualização de estado de rastreamento:

```json
{
  "statusRastreamento": "AGUARDANDO_DESMONTE",
  "justificativa": "Triagem concluída e item liberado para desmontagem.",
  "versaoEsperada": 3
}
```

### 3.8 Movimentações

| Método | Rota | Objetivo | Sucesso |
|---|---|---|---|
| `GET` | `/api/v1/movimentacoes` | Consultar movimentações com filtros e paginação. | `200` paginado |
| `GET` | `/api/v1/movimentacoes/:movimentacaoId` | Consultar um evento histórico. | `200` |
| `GET` | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Consultar eventos de um equipamento. | `200` paginado |
| `POST` | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Registrar novo evento de movimentação. | `201` + `Location` |

Corpo de criação proposto:

```json
{
  "destino": "Almoxarifado central",
  "observacao": "Transferência para armazenamento.",
  "versaoEsperada": 3
}
```

`equipamentoId` vem do caminho; `responsavelId`/nome de responsável deriva do usuário autenticado e é preenchido pelo servidor; `dataHora` é gerada pelo servidor; `origem` é calculada a partir do último destino do equipamento ou do contexto inicial do lote, a confirmar no fechamento ER8. O corpo não deve permitir atribuir uma movimentação a outro responsável. Movimentações são append-only: sem `PATCH` nem `DELETE` para editar/apagar um evento histórico. O evento e qualquer alteração relacionada de status precisam ser persistidos na mesma transação quando aplicável.

### 3.9 Auditoria, relatórios e parâmetros

Esses endpoints são previstos pelo backlog, mas a cobertura exata de cada relatório e a política de auditoria ainda estão pendentes.

| Método | Rota proposta | Objetivo | Observação |
|---|---|---|---|
| `GET` | `/api/v1/auditorias` | Consultar eventos de auditoria. | Disponível conforme papel/matriz aprovada; filtros a definir após ER11. |
| `GET` | `/api/v1/relatorios/operacionais` | Indicadores operacionais. | Filtros por período, organização e estado/status, conforme necessidade confirmada. |
| `GET` | `/api/v1/relatorios/triagem` | Resumo/distribuição de triagem. | Pode agregar por lote/equipamento. |
| `GET` | `/api/v1/relatorios/financeiros` | Indicadores financeiros/depreciação. | Não liberar antes de fechar quais papéis podem ver valores. |
| `GET` | `/api/v1/parametros` | Consultar parâmetros globais. | Campos e defaults a definir. |
| `PATCH` | `/api/v1/parametros` | Atualizar parâmetros globais. | Somente Administrador; mudanças auditadas se a política final exigir. |

Nenhum endpoint desses deve expor credenciais, tokens ou segredos. Se o prazo exigir corte de escopo, relatórios avançados podem ser reduzidos, mas a limitação deve ser registrada no README/ADR e no OpenAPI.

## 4. Paginação, ordenação e filtros

### 4.1 Parâmetros de paginação

- `page`: inteiro a partir de `1`; padrão `1`.
- `pageSize`: inteiro de `1` a `100`; padrão `20`.
- `sortBy`: campo permitido para aquela listagem. Campo fora da allow-list retorna `400`.
- `sortOrder`: `asc` ou `desc`; padrão `asc`.
- Filtros são combinados por AND. `q` é pesquisa textual, normalizada, sobre os campos documentados para cada recurso.
- Entradas numéricas, booleanas, UUID, enum e datas têm validação explícita. Não aceitar operadores SQL/Prisma livres nos parâmetros.

### 4.2 Filtros acordados

| Recurso/rota | Query parameters | Significado |
|---|---|---|
| `GET /organizacoes` | `q`, `ativo` | `q` pesquisa razão social, CNPJ e campos textuais de contato permitidos; `ativo` aceita `true`/`false`. |
| `GET /contratos` | `organizacaoId`, `status`, `vencimentoDe`, `vencimentoAte` | Organização, estado contratual e intervalo de vencimento; o domínio exato de `status` depende de ER3. |
| `GET /lotes` | `q`, `organizacaoId`, `status`, `dataEntradaDe`, `dataEntradaAte`, `ativo` | Busca textual, vínculo, status de processamento, intervalo de entrada e ativo. O parâmetro `status` filtra `statusProcessamento`. |
| `GET /equipamentos` | `q`, `loteId`, `tipo`, `estadoFisico`, `statusRastreamento`, `ativo` | Busca por código interno/marca/modelo e filtros de domínio. |
| `GET /movimentacoes` | `equipamentoId`, `responsavelId`, `de`, `ate` | Equipamento, ator responsável e intervalo de data/hora inclusivo. `de` e `ate` são timestamps ISO 8601. |
| `GET /usuarios` | `q`, `papel`, `ativo` | Proposta mínima para administração de usuários; precisa estar alinhada à matriz RBAC e ao modelo final. |

Em filtros por período, `de` não pode ser posterior a `ate`. Períodos inválidos respondem `400`. Para datas só com dia, documentar o fuso adotado; preferir enviar timestamps com `Z` ou offset explícito.

## 5. Campos de concorrência e regras em transações

- Recursos mutáveis incluem `versao` na resposta; operações `PATCH` e ações críticas devem receber `versaoEsperada` no corpo quando alterarem esse recurso.
- Se `versaoEsperada` estiver ausente onde for obrigatória, `400 VALIDATION_ERROR`; se o valor estiver desatualizado, `409 VERSION_CONFLICT`.
- Não aceitar `versao` enviado pelo cliente como novo valor.
- Criação de movimentação, atualização relacionada de equipamento, mudança de estado de lote e gravação de auditoria (se exigida para a operação) devem ocorrer em transação conforme decisão de consistência do caso de uso.
- Movimentações e eventos de auditoria são registros históricos append-only; uma correção futura deve ser registrada como novo evento compensatório ou seguir política explícita, nunca apagar silenciosamente o registro original.
- Regras de integridade críticas devem existir no service e, quando viável, no banco (chaves estrangeiras, índices únicos, checks), mapeando violações conhecidas para erros HTTP estáveis.

## 6. Matriz de códigos HTTP

| Código | Quando usar |
|---|---|
| `200 OK` | Consulta, atualização com representação no corpo, e ação de ciclo de vida que devolve o recurso atualizado. |
| `201 Created` | Criação de organização, contrato, lote, equipamento, usuário ou movimentação; enviar `Location` com a URI do recurso criado. |
| `204 No Content` | Logout, troca de senha ou operação sem representação de resposta quando o contrato não exigir recurso atualizado. |
| `400 Bad Request` | JSON/schema inválido, enum inválido, UUID malformado, query param inválido ou `versaoEsperada` ausente/fora do formato. |
| `401 Unauthorized` | Token ausente, inválido, expirado ou revogado; usuário desativado; credenciais de login inválidas. Para login, usar mensagem genérica. |
| `403 Forbidden` | Usuário autenticado, ativo e com token válido, mas sem permissão para a operação. |
| `404 Not Found` | Recurso inexistente ou recurso filho que não pertence ao pai indicado na rota aninhada. |
| `409 Conflict` | CNPJ/código de barras/login duplicado, conflito de contrato vigente, transição inválida, bloqueio por dependências, violação de regra de negócio ou conflito de versão. |
| `500 Internal Server Error` | Falha inesperada; resposta genérica com `requestId`, sem stack trace. |

O `500` nunca deve revelar query, stack trace, connection string, ambiente, credencial ou detalhes internos do Prisma. Erros de constraint conhecidos devem ser mapeados para `400` ou `409` conforme a causa, não vazados como falha inesperada.

## 7. Questões de domínio/Prisma ainda abertas (não bloqueiam a proposta de URLs)

Antes de considerar o contrato fechado e gerar o schema Prisma/OpenAPI final, ainda precisam ser tomadas ou confirmadas estas decisões já listadas no questionário de domínio:

1. **ER3 — Contrato:** representação persistida/derivada de vigente, vencido e cancelado; política para criar contrato quando o anterior venceu; significado final de `ativo`.
2. **ER4–ER7:** campos obrigatórios/opcionais de organização, representação de cláusulas, unicidade/estrutura de nota fiscal e política de posição do equipamento no lote.
3. **ER8:** relação de responsável da movimentação (FK para usuário e snapshot), tratamento de origem/destino e se os locais são texto livre ou catálogo controlado.
4. **ER9–ER11:** forma final do modelo de usuário, tabela de revogação JWT e escopo/imutabilidade da auditoria.
5. **ER12–ER13:** escala numérica de dinheiro/peso e precisão temporal; entidades que terão `versao` e quais escritas exigem `versaoEsperada`.
6. **Comportamento:** janela de data de entrada do lote; se a triagem é individual ou em lote; campos obrigatórios para finalizar; acoplamento entre movimento e mudança de status; política de relatório/financeiro; parâmetros e taxa de depreciação; tratamento exato de revogação ao desativar usuário.

Esses itens podem modificar schemas de request/response, mas não mudam as decisões R1–R12 já registradas. Rotas marcadas como “proposta” devem ser validadas contra as User Stories e regras de domínio antes de implementação.

## 8. Critérios de aceite do contrato REST

- [ ] Todas as rotas de negócio usam `/api/v1`.
- [ ] UUIDs são gerados e validados pelo servidor como IDs técnicos.
- [ ] Itens usam objeto JSON direto; coleções paginadas usam `{ data, meta }`.
- [ ] Todos os erros seguem `{ error: { code, message, details?, requestId? } }`.
- [ ] Todas as listagens implementam os parâmetros de paginação e filtros descritos, com allow-list de ordenação.
- [ ] Endpoints críticos de transição não permitem alterar status arbitrariamente via `PATCH`.
- [ ] Rotas de contrato preservam o histórico e permitem listar por organização e consultar por ID.
- [ ] Não há `DELETE` físico para entidades de negócio/histórico sem decisão expressa de domínio.
- [ ] JWT é validado em todas as rotas protegidas e a revogação por `jti` é testada.
- [ ] Erros `400`, `401`, `403`, `404`, `409` e `500` têm testes automatizados.
- [ ] OpenAPI descreve request, response, filtros, autorização, códigos HTTP e exemplos coerentes com as rotas implementadas.

---

**Regra de governança:** esta é a proposta REST resultante das escolhas R1–R12. Mudanças posteriores devem ser registradas em ADR ou na seção de decisões do projeto, com justificativa e impacto no OpenAPI, nos testes e no schema Prisma.
