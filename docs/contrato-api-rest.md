# 06 — Contrato da API REST

## 1. Convenções aprovadas

- Base local: `http://localhost:3000`.
- Rotas de negócio: prefixo `/api/v1`.
- Recursos plurais em português e propriedades `camelCase`.
- IDs técnicos UUID gerados no servidor; identificadores de negócio (CNPJ e código de barras) não são PK.
- Request e response de negócio em JSON; datas ISO 8601 com timezone; persistência UTC.
- Itens individuais como objeto JSON direto.
- Coleções paginadas como `{ "data": [], "meta": { "page", "pageSize", "totalItems", "totalPages", "sortBy", "sortOrder" } }`.
- `page` padrão 1; `pageSize` padrão 20, mínimo 1 e máximo 100; `sortBy` limitado a allow-list por endpoint; `sortOrder` `asc`/`desc`, padrão `asc`.
- Filtros combinados por AND. Rejeitar parâmetros, enums, UUIDs, datas e ordenação fora do formato aceito.
- Escritas em recurso mutável devem enviar `versaoEsperada` quando previsto. `versao` é controlado pelo servidor.
- Não expor `DELETE` para apagar fisicamente recursos com histórico.

## 2. Formato de erro

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A requisição contém campos inválidos.",
    "details": [{ "field": "cnpj", "reason": "INVALID_CHECK_DIGITS" }],
    "requestId": "req-example"
  }
}
```

`details` e `requestId` são opcionais. Códigos estáveis mínimos: `VALIDATION_ERROR`, `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`, `TOKEN_REVOKED`, `USER_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_CNPJ`, `DUPLICATE_CODIGO_BARRAS`, `DUPLICATE_LOGIN`, `BUSINESS_RULE_CONFLICT`, `INVALID_STATE_TRANSITION`, `VERSION_CONFLICT`, `INTERNAL_ERROR`.

## 3. Códigos HTTP

| HTTP | Uso |
|---|---|
| `200` | Consulta, alteração que retorna representação e ação de ciclo de vida que retorna recurso atualizado |
| `201` | Criação; inclui `Location` para o recurso |
| `204` | Operação bem-sucedida sem corpo, como logout/troca de senha |
| `400` | Entrada inválida, schema inválido, UUID malformado, filtro inválido ou `versaoEsperada` ausente/fora do formato |
| `401` | Credencial inválida, token ausente/inválido/expirado/revogado ou usuário desativado |
| `403` | Autenticado, mas sem permissão |
| `404` | Recurso inexistente ou filho que não pertence ao pai na rota aninhada |
| `409` | Unicidade, regra de negócio, estado inválido, dependência impeditiva ou conflito de versão |
| `500` | Erro inesperado, com mensagem pública genérica e requestId, sem stack trace |

Não usar `422` no contrato inicial.

## 4. Saúde e documentação — públicas

| Método | Rota | Sucesso |
|---|---|---|
| GET | `/health` | `200` estado mínimo do servidor |
| GET | `/docs` | Interface Swagger |
| GET | `/docs/json` | OpenAPI em JSON |

## 5. Autenticação e conta

| Método | Rota | Permissão |
|---|---|---|
| POST | `/api/v1/auth/login` | Pública |
| POST | `/api/v1/auth/logout` | Usuário autenticado; revoga o `jti` atual; `204` |
| GET | `/api/v1/auth/me` | Usuário autenticado |
| POST | `/api/v1/auth/change-password` | Usuário autenticado; valida senha atual; `204` |

Login recebe `{ "usuario": "...", "senha": "..." }`. Resposta inclui `accessToken`, `tokenType: "Bearer"`, `expiresIn: 1800` e dados públicos do usuário (`id`, `usuario`, `nome`, `papel`, `ativo`). Nunca devolver senha/hash.

## 6. Usuários — Administrador

| Método | Rota | Objetivo |
|---|---|---|
| GET | `/api/v1/usuarios` | Listar/pesquisar com paginação |
| POST | `/api/v1/usuarios` | Criar usuário (`201` + `Location`) |
| GET | `/api/v1/usuarios/:usuarioId` | Consultar |
| PATCH | `/api/v1/usuarios/:usuarioId` | Atualizar campos permitidos e `versaoEsperada` |
| POST | `/api/v1/usuarios/:usuarioId/desativacao` | Desativar e revogar tokens conhecidos |
| POST | `/api/v1/usuarios/:usuarioId/reativacao` | Reativar |
| POST | `/api/v1/usuarios/:usuarioId/redefinicao-senha` | Iniciar redefinição administrativa conforme política |

Não permitir auto-desativação nem desativar último Administrador ativo. Login único após normalização.

## 7. Organizações — Administrador e Operador de Cadastro

| Método | Rota | Objetivo |
|---|---|---|
| GET | `/api/v1/organizacoes` | Listar/pesquisar/filtros/paginação |
| POST | `/api/v1/organizacoes` | Criar |
| GET | `/api/v1/organizacoes/:organizacaoId` | Consultar |
| PATCH | `/api/v1/organizacoes/:organizacaoId` | Atualizar campos permitidos |
| POST | `/api/v1/organizacoes/:organizacaoId/desativacao` | Desativar sem apagar histórico |
| POST | `/api/v1/organizacoes/:organizacaoId/reativacao` | Reativar |

Campos de entrada: `razaoSocial`, `cnpj`, `inscricaoEstadual?`, `enderecoCompleto?`, `telefone?`, `email?`. `id`, `dataCadastro` e `versao` são controlados pelo servidor. Resposta não expande todo o histórico contratual por padrão; disponibiliza o identificador do contrato vigente, quando houver, e a consulta histórica própria.

## 8. Contratos — Administrador e Operador de Cadastro

| Método | Rota | Objetivo |
|---|---|---|
| GET | `/api/v1/organizacoes/:organizacaoId/contratos` | Histórico por organização, paginado |
| POST | `/api/v1/organizacoes/:organizacaoId/contratos` | Criar contrato contextual (`201`) |
| GET | `/api/v1/organizacoes/:organizacaoId/contratos/:contratoId` | Consultar e validar pertencimento |
| GET | `/api/v1/contratos` | Listar/filtrar contratos |
| GET | `/api/v1/contratos/:contratoId` | Consultar por UUID |
| PATCH | `/api/v1/contratos/:contratoId` | Atualizar campos permitidos |
| POST | `/api/v1/contratos/:contratoId/renovacao` | Encerrar o anterior e criar novo histórico em transação |
| POST | `/api/v1/contratos/:contratoId/cancelamento` | Cancelar preservando histórico |

Payload típico de criação: `dataVencimento`, `valorMensal` como string decimal, `clausulas` como lista de strings e `renovacaoAutomatica`. Renovação recebe novo `dataVencimento` obrigatório e pode receber `valorMensal`, `clausulas` e `renovacaoAutomatica`; campos omitidos herdam os valores do contrato anterior. CNPJ e UUID nunca são substituídos por IDs técnicos. O contrato deve ser criado para organização ativa e ter vencimento futuro e valor não negativo.

## 9. Lotes — Administrador e Gestor de Almoxarifado

| Método | Rota | Objetivo |
|---|---|---|
| GET | `/api/v1/lotes` | Listar/pesquisar/filtrar lotes |
| POST | `/api/v1/lotes` | Criar lote (`201`) |
| GET | `/api/v1/lotes/:loteId` | Consultar lote e totais calculados |
| PATCH | `/api/v1/lotes/:loteId` | Atualizar atributos, sem alterar status arbitrariamente |
| POST | `/api/v1/lotes/:loteId/triagem` | Triagem simplificada herdada; transição e equipamentos em transação |
| POST | `/api/v1/lotes/:loteId/encaminhamento` | Encaminhar após triagem concluída |
| POST | `/api/v1/lotes/:loteId/finalizacao` | Finalizar após encaminhamento |
| POST | `/api/v1/lotes/:loteId/desativacao` | Desativar se regras permitirem |
| POST | `/api/v1/lotes/:loteId/reativacao` | Reativar |
| GET | `/api/v1/lotes/:loteId/equipamentos` | Listar equipamentos do lote |

`GET /api/v1/lotes` filtros: `q`, `organizacaoId`, `status`, `dataEntradaDe`, `dataEntradaAte`, `ativo`.

## 10. Equipamentos — Administrador e Gestor de Almoxarifado

| Método | Rota | Objetivo |
|---|---|---|
| GET | `/api/v1/equipamentos` | Listar/pesquisar/filtrar |
| POST | `/api/v1/equipamentos` | Criar vinculado a lote (`201`) |
| GET | `/api/v1/equipamentos/:equipamentoId` | Consultar |
| PATCH | `/api/v1/equipamentos/:equipamentoId` | Alterar somente atributos permitidos |
| POST | `/api/v1/equipamentos/:equipamentoId/estado-fisico` | Alterar estado físico com justificativa se exigida |
| POST | `/api/v1/equipamentos/:equipamentoId/status-rastreamento` | Mudar status com justificativa obrigatória |
| POST | `/api/v1/equipamentos/:equipamentoId/desativacao` | Desativar sem apagar histórico |
| POST | `/api/v1/equipamentos/:equipamentoId/reativacao` | Reativar |
| GET | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Consultar histórico conforme RBAC (Administrador/Auditor) |
| POST | `/api/v1/equipamentos/:equipamentoId/movimentacoes` | Registrar movimentação autenticada (`201`) |

`GET /api/v1/equipamentos` filtros: `q`, `loteId`, `tipo`, `estadoFisico`, `statusRastreamento`, `ativo`.

## 11. Movimentações

| Método | Rota | Permissão |
|---|---|---|
| GET | `/api/v1/movimentacoes` | Administrador/Auditor, leitura paginada |
| GET | `/api/v1/movimentacoes/:movimentacaoId` | Administrador/Auditor, leitura |

Filtros: `equipamentoId`, `responsavelId`, `de`, `ate`. `de` não pode ser posterior a `ate`. Criação ocorre pela rota aninhada do equipamento; ator e data/hora são definidos pelo servidor. Sem PATCH/PUT/DELETE para movimentações.

## 12. Auditoria, relatórios e parâmetros

| Método | Rota | Permissão/objetivo |
|---|---|---|
| GET | `/api/v1/auditorias` | Administrador/Auditor; consulta de eventos sem segredos |
| GET | `/api/v1/relatorios/operacionais` | Administrador/Auditor; relatórios básicos por organização/período/status |
| GET | `/api/v1/relatorios/triagem` | Administrador/Auditor; distribuição de triagem/lotes/equipamentos |
| GET | `/api/v1/relatorios/financeiros` | Administrador/Auditor, somente leitura; simplificável e a limitação deve ser documentada |
| GET | `/api/v1/parametros` | Administrador consulta parâmetros globais |
| PATCH | `/api/v1/parametros` | Somente Administrador atualiza parâmetros e `versaoEsperada` quando aplicável |

## 13. Filtros e validações transversais

- Organizações: `q` pesquisa razão social/CNPJ/contatos permitidos; `ativo` booleano.
- Contratos: `organizacaoId`, `status` derivado, `vencimentoDe`, `vencimentoAte`.
- Listas são paginadas e têm ordenação determinística; `sortBy` sempre usa allow-list do endpoint.
- Datas de período precisam ser válidas e `de <= ate`.
- UUID malformado retorna `400`; UUID válido inexistente retorna `404`.
- Conflitos conhecidos do Prisma são convertidos para `409` quando representarem duplicidade/estado/concorrência; nunca retornar mensagem bruta de banco.
