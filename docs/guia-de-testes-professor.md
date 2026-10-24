# Guia de execução e testes — GreenCode AV2

Este guia foi pensado para executar no computador da avaliação. Ele mostra como subir o sistema, testar a API e conferir os resultados sem precisar instalar Node.js ou PostgreSQL na máquina: a execução principal usa Docker Desktop e Docker Compose.

## 1. Preparar e iniciar o projeto

**Pré-requisito:** Docker Desktop instalado e iniciado. Baixe/clonе o repositório completo do GreenCode AV2 e abra o PowerShell na pasta onde estão `docker-compose.yml` e `Dockerfile`.

Crie a configuração local a partir do exemplo:

```powershell
Copy-Item .env.example .env
notepad .env
```

No arquivo `.env`, substitua os valores de exemplo:

- `POSTGRES_PASSWORD`: senha local do banco. Prefira letras, números e `_`, pois ela também será usada na URL de conexão.
- `JWT_SECRET`: segredo aleatório com pelo menos 32 bytes. No PowerShell, gere um valor com `([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))` e copie o resultado para o arquivo.
- `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD`: dados do administrador inicial. A senha precisa ter pelo menos 12 caracteres.

Esses valores são locais para a avaliação. Não envie o `.env` por e-mail, não o coloque no Git e não o anexe a relatórios.

Inicie a aplicação e o banco:

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Na primeira inicialização, o serviço aguarda o PostgreSQL, aplica as migrações e executa o seed antes de iniciar a API. Quando os logs indicarem que a API está ouvindo, abra:

- `http://localhost:3000/health` — deve responder `200` com `status: "ok"`.
- `http://localhost:3000/docs` — interface Swagger para executar as rotas.
- `http://localhost:3000/docs/json` — contrato OpenAPI em JSON.

Se a porta 3000 já estiver ocupada, pare o serviço que a utiliza e tente novamente. Se a API não iniciar, consulte `docker compose logs api` e `docker compose logs postgres`.

**Parar e reiniciar:** `docker compose down` para sem apagar os dados. `docker compose down -v` apaga também o banco nos volumes deste Compose; use somente quando desejar recomeçar a avaliação do zero.

## 2. Como testar pelo Swagger

1. Abra `http://localhost:3000/docs`.
2. Expanda `POST /api/v1/auth/login`, clique em **Try it out** e informe o usuário e a senha configurados em `.env`.
3. A resposta esperada é `200` e contém `accessToken`, `tokenType: "Bearer"`, `expiresIn: 1800` e dados públicos do usuário.
4. Clique em **Authorize** e cole o `accessToken`. O Swagger acrescenta o prefixo `Bearer` ao usar o esquema JWT.
5. Agora execute as rotas protegidas. Depois de mudar de usuário para testar permissões, atualize o token na opção **Authorize**.

Os esquemas de cada rota no Swagger mostram os campos obrigatórios e os formatos aceitos. Nos exemplos seguintes, substitua os textos entre `<...>` pelos IDs reais devolvidos pela API.

## 3. Jornada principal de demonstração

Faça os testes na ordem abaixo, porque cada etapa utiliza um registro criado anteriormente. Os exemplos criam dados de avaliação; não os use em um ambiente de produção.

### A. Usuários e permissões

Como Administrador, teste `GET /api/v1/usuarios` (esperado `200`) e crie uma conta de cada papel com `POST /api/v1/usuarios`. Exemplo de corpo:

```json
{
  "usuario": "avaliacao_operador",
  "nome": "Operador de Avaliação",
  "senha": "TroqueEstaSenha!2026",
  "papel": "OPERADOR_CADASTRO"
}
```

Repita com logins diferentes e papéis `GESTOR_ALMOXARIFADO` e `AUDITOR`. Guarde as senhas apenas no ambiente de teste. Resposta esperada na criação: `201`; a resposta não deve incluir senha ou hash.

Teste `GET /api/v1/usuarios/{usuarioId}`, `PATCH /api/v1/usuarios/{usuarioId}`, `POST /api/v1/usuarios/{usuarioId}/redefinicao-senha`, `/desativacao` e `/reativacao`. Para `PATCH`, informe `versaoEsperada` conforme a última resposta. Redefinição recebe `novaSenha` (mínimo de 12 caracteres) e responde `204`; desativação e reativação também respondem `204`.

Para conferir a autorização, entre no Swagger como `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR` e teste `GET /api/v1/usuarios`. Esperado: `403`. Um token ausente, inválido ou revogado deve receber `401`.

### B. Organização

Use `POST /api/v1/organizacoes`:

```json
{
  "razaoSocial": "Organização de Avaliação AV2",
  "cnpj": "11222333000181",
  "inscricaoEstadual": "ISENTO",
  "enderecoCompleto": "Rua de Avaliação, 100",
  "telefone": "11999990000",
  "email": "avaliacao@example.invalid"
}
```

Esperado: `201`. Guarde o `id` retornado como `<organizacaoId>`. Em seguida teste `GET /api/v1/organizacoes`, `GET /api/v1/organizacoes/{organizacaoId}` e `PATCH /api/v1/organizacoes/{organizacaoId}`. O PATCH exige `versaoEsperada` e pelo menos um campo permitido; esperado `200` e versão incrementada. Teste também `/desativacao` e `/reativacao` (esperado `204`). A desativação deve ser recusada com `409` se existir algum lote dessa organização que ainda não foi finalizado.

Se o CNPJ do exemplo já estiver usado, escolha outro CNPJ de teste válido. Um CNPJ inválido deve ser recusado; duplicidade deve resultar em conflito, normalmente `409`.

### C. Contrato e histórico

Com a organização ativa, execute `POST /api/v1/organizacoes/{organizacaoId}/contratos`:

```json
{
  "dataVencimento": "<data-e-hora-ISO-futura>",
  "valorMensal": "1250.00",
  "clausulas": ["Contrato de avaliação"],
  "renovacaoAutomatica": false
}
```

Substitua `<data-e-hora-ISO-futura>` por uma data/hora futura no formato ISO 8601. Para gerar uma data válida no PowerShell, execute `(Get-Date).ToUniversalTime().AddYears(1).ToString("o")` e copie o valor para o JSON. Esperado: `201` com status `VIGENTE`. Guarde o `id` como `<contratoId>`.

Teste `GET /api/v1/contratos`, `GET /api/v1/contratos/{contratoId}`, `GET /api/v1/organizacoes/{organizacaoId}/contratos` e a consulta aninhada `/api/v1/organizacoes/{organizacaoId}/contratos/{contratoId}`. Devem responder `200` para registros existentes. O contrato aninhado deve retornar `404` se o contrato não pertencer à organização informada.

Teste `PATCH /api/v1/contratos/{contratoId}` com `versaoEsperada` e um campo permitido. Para renovar, use `POST /api/v1/contratos/{contratoId}/renovacao` com um novo `dataVencimento` posterior ao anterior. Esperado: `201` para o novo contrato; o anterior continua consultável no histórico. Teste `POST /api/v1/contratos/{contratoId}/cancelamento`; esperado `204`. Um contrato cancelado não pode ser editado/renovado, e cancelar novamente deve gerar `409`.

### D. Lote e equipamento

Crie um lote com `POST /api/v1/lotes`:

```json
{
  "organizacaoId": "<organizacaoId>",
  "notaFiscal": "NF-AV2-AVALIACAO-001",
  "transportadora": "Transportadora de Avaliação",
  "observacoes": "Lote criado para teste do professor"
}
```

`dataEntrada` é opcional e, se omitida, recebe a data atual. Se informada, não pode ser futura nem ter mais de 90 dias. Esperado: `201` com `statusProcessamento: "RECEBIDO"`. Guarde o `id` como `<loteId>`.

Crie um equipamento por `POST /api/v1/equipamentos`:

```json
{
  "loteId": "<loteId>",
  "tipo": "NOTEBOOK",
  "marca": "MarcaTeste",
  "modelo": "Modelo de Avaliação",
  "anoFabricacao": 2022,
  "estadoFisico": "BOM_ESTADO",
  "pesoQuilogramas": "2.150",
  "valorAquisicao": "2500.00"
}
```

Esperado: `201`, com `codigoBarrasInterno` gerado pelo servidor e `statusRastreamento: "AGUARDANDO_TRIAGEM"`. Guarde o `id` como `<equipamentoId>`.

Teste `GET /api/v1/lotes`, `GET /api/v1/lotes/{loteId}`, `PATCH /api/v1/lotes/{loteId}`, `GET /api/v1/lotes/{loteId}/equipamentos`, `GET /api/v1/equipamentos`, `GET /api/v1/equipamentos/{equipamentoId}` e `PATCH /api/v1/equipamentos/{equipamentoId}`. Atualizações exigem `versaoEsperada` e respondem `200` se válidas.

Para testar estado físico, use `POST /api/v1/equipamentos/{equipamentoId}/estado-fisico` com `versaoEsperada` e `estadoFisico`. Uma degradação de duas ou mais categorias exige `justificativa`. Para status de rastreamento, use `/status-rastreamento`; a justificativa é sempre obrigatória. Tentar ir para `EM_DESMONTE` antes de `AGUARDANDO_DESMONTE` deve retornar `409`.

### E. Triagem, movimentação e finalização

Antes da triagem, confirme que o lote está ativo e tem pelo menos um equipamento ativo aguardando triagem. Execute `POST /api/v1/lotes/{loteId}/triagem`, informando a versão atual se disponível. Esperado: `200`, lote em `TRIAGEM_CONCLUIDA` e equipamento em `AGUARDANDO_DESMONTE`. A API faz essa transição; não coloque manualmente o equipamento em `EM_TRIAGEM` antes de executar a triagem.

Registre uma movimentação com `POST /api/v1/equipamentos/{equipamentoId}/movimentacoes`:

```json
{
  "destino": "Área de triagem",
  "observacao": "Movimentação de avaliação"
}
```

Esperado: `201`. O servidor define responsável, data/hora e origem. Em seguida consulte `GET /api/v1/movimentacoes`, `GET /api/v1/movimentacoes/{movimentacaoId}` e `GET /api/v1/equipamentos/{equipamentoId}/movimentacoes` com um Administrador ou Auditor.

Depois, faça `POST /api/v1/lotes/{loteId}/encaminhamento` (esperado `200`, estado `ENCAMINHADO`) e `POST /api/v1/lotes/{loteId}/finalizacao` (esperado `200`, estado `FINALIZADO`). Finalizar antes de encaminhar deve retornar `409`. Lote vazio não pode ser triado nem finalizado.

Com o lote finalizado, teste suas rotas `/desativacao` e `/reativacao`. Teste também `POST /api/v1/equipamentos/{equipamentoId}/desativacao` e `/reativacao`; confira o campo `ativo` na resposta. O histórico deve ser preservado.

### F. Parâmetros, auditoria e relatórios

Como Administrador, consulte `GET /api/v1/parametros`. Defaults esperados: imposto `0` e depreciação anual `15`. Teste `PATCH /api/v1/parametros` com `versaoEsperada`, `aliquotaImpostoPercentual` e `taxaDepreciacaoAnualPercentual`; ambos os percentuais aceitam valores de 0 a 100. Restaure os valores desejados depois do teste.

Como Administrador ou Auditor, teste:

- `GET /api/v1/auditorias?page=1&pageSize=20`
- `GET /api/v1/relatorios/operacionais`
- `GET /api/v1/relatorios/triagem`
- `GET /api/v1/relatorios/financeiros`

Esperado: `200` e JSON. Faça uma alteração de negócio antes da consulta de auditoria para que haja eventos recentes. Relatórios com base vazia podem retornar totais iguais a zero; isso, sozinho, não é erro.

## 4. Lista completa de rotas por função

O Swagger mostra os corpos e os códigos de resposta de cada operação. Use esta lista para confirmar que nenhum grupo ficou sem teste.

| Área | Rotas | Quem pode testar |
|---|---|---|
| Saúde/documentação | `GET /health`, `GET /docs`, `GET /docs/json` | Público |
| Sessão | `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/change-password` | Login público; demais com usuário autenticado |
| Usuários | `GET/POST /api/v1/usuarios`; `GET/PATCH /api/v1/usuarios/{usuarioId}`; POST nos sufixos `/desativacao`, `/reativacao`, `/redefinicao-senha` | Administrador |
| Organizações | `GET/POST /api/v1/organizacoes`; `GET/PATCH /api/v1/organizacoes/{organizacaoId}`; POST nos sufixos `/desativacao`, `/reativacao` | Administrador, Operador de Cadastro |
| Contratos | `GET /api/v1/contratos`, `GET /api/v1/contratos/{contratoId}`, `PATCH /api/v1/contratos/{contratoId}`; GET/POST histórico aninhado em `/api/v1/organizacoes/{organizacaoId}/contratos`; `POST /api/v1/contratos/{contratoId}/renovacao` e `/cancelamento` | Administrador, Operador de Cadastro |
| Lotes | `GET/POST /api/v1/lotes`; `GET/PATCH /api/v1/lotes/{loteId}`; POST em `/triagem`, `/encaminhamento`, `/finalizacao`, `/desativacao`, `/reativacao`; GET `/api/v1/lotes/{loteId}/equipamentos` | Administrador, Gestor de Almoxarifado |
| Equipamentos | `GET/POST /api/v1/equipamentos`; `GET/PATCH /api/v1/equipamentos/{equipamentoId}`; POST em `/estado-fisico`, `/status-rastreamento`, `/desativacao`, `/reativacao` | Administrador, Gestor de Almoxarifado |
| Movimentações | `POST /api/v1/equipamentos/{equipamentoId}/movimentacoes`; GET `/api/v1/movimentacoes`, `/api/v1/movimentacoes/{movimentacaoId}` e `/api/v1/equipamentos/{equipamentoId}/movimentacoes` | Criar: Administrador/Gestor; consultar: Administrador/Auditor |
| Auditoria | `GET /api/v1/auditorias` | Administrador, Auditor |
| Relatórios | `GET /api/v1/relatorios/operacionais`, `/triagem`, `/financeiros` | Administrador, Auditor |
| Parâmetros | `GET/PATCH /api/v1/parametros` | Administrador |

## 5. Testes negativos que demonstram as regras

| Cenário | Resultado esperado |
|---|---|
| Rota protegida sem token ou token revogado | `401` |
| Usuário autenticado sem o papel exigido | `403` |
| Corpo incompleto, enum inválido, CNPJ inválido ou data fora da regra | `400` |
| Recurso inexistente com UUID válido | `404` |
| CNPJ/login duplicado | `409` |
| Atualização com `versaoEsperada` antiga | `409`, sem alteração parcial |
| Desativar organização com lote não finalizado | `409` |
| Triar lote vazio | `409` |
| Encaminhar antes de concluir triagem ou finalizar antes de encaminhar | `409` |
| Alterar rastreamento para uma transição proibida | `409` |
| Movimentar equipamento desativado | `409` |

As mensagens de erro vêm em JSON, dentro do campo `error`, com um código e uma mensagem. O código HTTP e a regra devem corresponder ao caso testado; não marque como aprovado só porque a API respondeu.

## 6. Testes automatizados opcionais via Docker

Para rodar apenas os testes unitários/HTTP:

```powershell
docker compose --profile tests run --rm --no-deps test-runner npm test
```

Para os testes de integração, que usam um banco isolado com nome contendo `test`:

```powershell
docker compose --profile tests run --rm test-runner
```

O segundo comando prepara as migrações e o seed do banco de teste antes de executar a suíte de integração. Não altere a URL do banco de testes para apontar para o banco principal de avaliação.

## 7. Como registrar a avaliação

Para cada cenário, anote a rota, o papel usado, o resultado esperado, o status HTTP real e `PASSOU` ou `FALHOU`. Um teste passa quando o código HTTP, o conteúdo importante da resposta e a regra de negócio estão corretos.

Os testes automatizados registrados durante o desenvolvimento tiveram 25 aprovações unitárias/HTTP e 10 aprovações de integração. Isso é uma evidência útil, mas não equivale à homologação individual de todas as User Stories. A CI do GitHub deve ser conferida separadamente no repositório.
