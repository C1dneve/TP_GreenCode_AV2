# Guia de execução e testes — GreenCode AV2

Este guia foi pensado para executar no computador da avaliação. Ele mostra como subir o sistema, testar a API e conferir os resultados sem precisar instalar Node.js ou PostgreSQL na máquina: a execução principal usa Docker Desktop e Docker Compose.

## 1. Preparar e iniciar o projeto

Este procedimento foi escrito para um professor que está iniciando o projeto em uma cópia limpa. **Não é necessário instalar Node.js nem PostgreSQL no computador do avaliador**; a execução principal usa Docker Compose.

### Pré-requisitos

- **Windows 10 ou superior:** Docker Desktop instalado e iniciado. Use PowerShell ou Windows Terminal.
- **Ubuntu 24.04 ou superior:** Docker Engine e o plugin Docker Compose instalados e funcionando. Use o terminal Bash.
- O projeto extraído de um ZIP ou clonado do GitHub.
- Terminal aberto na pasta que contém `Dockerfile` e `docker-compose.yml`.

Os comandos `docker compose` abaixo funcionam tanto no PowerShell quanto no Bash. Somente os passos de criar o `.env`, gerar o segredo JWT e consultar a resposta HTTP têm variantes específicas de cada terminal.

### 1.1 Criar o arquivo local `.env`

**Windows (PowerShell):**

```powershell
if (-not (Test-Path .\.env)) { Copy-Item .env.example .env }
```

**Ubuntu (Bash):**

```bash
if [ ! -f .env ]; then cp .env.example .env; fi
```

Os comandos não sobrescrevem um `.env` que já exista. Os valores do `.env.example` são para avaliação local isolada. Podem ser mantidos para a demonstração, mas nunca devem ser usados em produção nem enviados ao GitHub. Caso altere `POSTGRES_PASSWORD`, prefira letras, números e `_` para evitar dificuldades de codificação na URL de conexão.

### 1.2 Gerar um segredo JWT aleatório

Gere 32 bytes aleatórios e grave o resultado hexadecimal em `JWT_SECRET`. Use apenas o bloco referente ao seu terminal. Ambos preservam os demais valores do `.env` e não exibem o segredo gerado.

**Windows (PowerShell):**

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$jwtSecret = ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
$envLines = Get-Content .\.env
if (-not ($envLines | Where-Object { $_ -match '^JWT_SECRET=' })) { throw 'A linha JWT_SECRET não foi encontrada no .env.' }
$envLines = $envLines -replace '^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret"
Set-Content -Path .\.env -Value $envLines -Encoding ascii
Write-Host 'JWT_SECRET gerado e gravado no .env; o valor não foi exibido.'
```

**Ubuntu (Bash):**

```bash
set -eu
secret="$(openssl rand -hex 32)"
grep -q '^JWT_SECRET=' .env || { echo 'A linha JWT_SECRET não foi encontrada no .env.' >&2; exit 1; }
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${secret}/" .env
unset secret
echo 'JWT_SECRET gerado e gravado no .env; o valor não foi exibido.'
```

No Ubuntu, o comando usa `openssl`. Caso não esteja instalado, instale-o pelo gerenciador de pacotes da distribuição. O segredo é local: não o compartilhe nem o registre em capturas de tela.

### 1.3 Validar a configuração

Execute no PowerShell ou no Bash:

```shell
docker compose config -q
docker compose --profile tests config -q
```

Os dois comandos devem terminar sem mensagem de erro. Eles validam a configuração, mas ainda não iniciam os containers.

### 1.4 Construir e iniciar a aplicação

Os comandos são iguais nos dois sistemas:

```shell
docker compose up --build -d
docker compose ps
```

Na primeira execução, o Docker baixa as imagens necessárias, constrói a imagem da API, inicia o PostgreSQL, aguarda o banco ficar saudável, aplica as migrações e executa o seed antes de iniciar a API. Aguarde até que `postgres` e `api` estejam com status `healthy`. Se ainda aparecerem como `starting`, aguarde alguns segundos e execute `docker compose ps` novamente.

### 1.5 Verificar a API

**Windows (PowerShell):**

```powershell
Invoke-RestMethod http://localhost:3000/health
```

**Ubuntu (Bash):**

```bash
curl --fail --show-error http://localhost:3000/health
```

A resposta deve conter `status: ok` e `service: greencode-api`. Abra no navegador:

- `http://localhost:3000/health` — verificação de saúde da API.
- `http://localhost:3000/docs` — interface Swagger para executar as rotas.
- `http://localhost:3000/docs/json` — contrato OpenAPI em JSON.

### 1.6 Login inicial no Swagger

Em uma avaliação com banco novo e valores de demonstração mantidos no `.env`, use em `POST /api/v1/auth/login`:

- **Usuário:** `admin_av2_local`
- **Senha:** `TroqueEstaSenhaLocal!2026`

Se alterou `BOOTSTRAP_ADMIN_USERNAME` ou `BOOTSTRAP_ADMIN_PASSWORD`, use os valores definidos por você. O seed cria o administrador inicial somente se ele ainda não existir; ele preserva a conta existente e não redefine a senha ao mudar as variáveis.

### 1.7 Logs, parada e reinicialização

Os seguintes comandos funcionam tanto no PowerShell quanto no Bash. Para acompanhar a inicialização:

```shell
docker compose logs -f api
```

Se a API não iniciar, consulte os logs dos dois serviços:

```shell
docker compose logs --tail=100 api
docker compose logs --tail=100 postgres
```

Para parar os serviços sem apagar o banco:

```shell
docker compose down
```

**Somente se quiser apagar os dados locais e recomeçar a avaliação do zero**, use:

```shell
docker compose down -v
```

Esse comando remove os volumes do banco deste Compose. Não o execute se precisar preservar os dados da avaliação. Se recriar o banco, execute novamente `docker compose up --build -d`; o seed criará o administrador com as variáveis atuais.

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

Substitua `<data-e-hora-ISO-futura>` por uma data/hora futura no formato ISO 8601. **Windows (PowerShell):** `(Get-Date).ToUniversalTime().AddYears(1).ToString("o")`. **Ubuntu (Bash):** `date -u -d "+1 year" +"%Y-%m-%dT%H:%M:%SZ"`. Copie o valor gerado para o JSON. Esperado: `201` com status `VIGENTE`. Guarde o `id` como `<contratoId>`.

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

## 6. Testes automatizados e CI

A validação manual pelo Swagger, descrita acima, é complementar e não substitui a execução automatizada. Os comandos abaixo funcionam no **PowerShell do Windows** e no **Bash do Ubuntu**, sempre executados na raiz do projeto. Não é necessário instalar Node.js nem PostgreSQL diretamente na máquina se você executar os testes pelo Docker Compose.

### 6.1. Testes unitários/HTTP

Execute:

```shell
docker compose --profile tests run --rm --no-deps test-runner npm test
```

O comando executa o script `npm test`, que gera o cliente Prisma, compila o TypeScript e roda os testes unitários/HTTP de `src/tests/`. A opção `--no-deps` evita iniciar o contêiner do PostgreSQL de teste; os testes deste grupo não dependem de uma conexão real com o banco.

### 6.2. Testes de integração HTTP + PostgreSQL

Execute separadamente:

```shell
docker compose --profile tests run --rm test-runner
```

O serviço `test-runner` aguarda o PostgreSQL de teste ficar saudável, aplica as migrações, executa o seed e roda `npm run test:integration`. Os dados de teste ficam no banco dedicado `greencode_test`. A suíte verifica o nome do banco e não deve ser apontada para o banco principal da avaliação nem para produção.

Os testes críticos incluem:

- **Revogação JWT:** depois de `POST /api/v1/auth/logout`, o mesmo token deve ser rejeitado numa rota protegida com `401`.
- **Concorrência otimista:** uma atualização com `versaoEsperada` antiga deve receber `409` e não sobrescrever a primeira atualização válida.
- **Rollback transacional:** uma falha controlada na gravação de auditoria durante a triagem deve reverter as alterações associadas à transação, sem auditoria parcial.

O teste de rollback cria e remove um gatilho temporário apenas no banco de teste; não adiciona ganchos ao código de produção.

Na execução local registrada em 25/10/2026, a suíte de testes unitários/HTTP terminou com **26 testes aprovados e 0 falhas**, e a suíte de integração com PostgreSQL terminou com **13 testes aprovados e 0 falhas**. Também foram validadas a configuração e a geração do Prisma Client, a compilação TypeScript, a aplicação das migrations e duas execuções consecutivas da seed no banco principal da aplicação. O endpoint `GET /health` retornou `status: ok` e `service: greencode-api`.

Esses resultados documentam a execução local nessa data. A contagem pode mudar quando novos testes forem adicionados; consulte sempre o resumo real dos comandos. Os testes aprovados fornecem evidência apenas dos cenários executados e não representam homologação automática de todas as User Stories.

### 6.3. Teste de fumaça Docker Compose no GitHub Actions

O job `Docker Compose smoke test`, em `.github/workflows/ci.yml`, constrói a imagem da API, inicia PostgreSQL e API com um projeto Compose isolado em runner Ubuntu, aguarda os healthchecks e valida a resposta de `GET /health`. Em caso de falha, coleta logs; ao final, remove os recursos exclusivos daquele job.

Depois de publicar alterações que mudam o workflow, abra a aba **Actions** do GitHub e confira o run do commit correspondente. A existência do job no YAML não significa, por si só, que ele já passou. Esse teste também não substitui as suítes unitária/HTTP e de integração.

### 6.4. Validação do Prisma e build via Docker Compose

A validação e a compilação também podem ser executadas dentro dos containers, sem instalar Node.js diretamente no computador. Primeiro, inicie a aplicação conforme a seção 1 deste guia, caso ainda não esteja em execução.

Execute os comandos abaixo na raiz do projeto:

```shell
docker compose exec api npm run prisma:validate
docker compose exec api npm run prisma:generate
docker compose exec api npm run build
```

Os comandos verificam o schema do Prisma, geram o Prisma Client e compilam o TypeScript dentro do container da API.

As suítes automatizadas devem ser executadas pelos comandos das seções 6.1 e 6.2: a primeira executa os testes unitários/HTTP e a segunda executa os testes de integração com PostgreSQL em um banco de teste isolado.

Se o container da API não estiver em execução, inicie os serviços conforme a seção 1 antes de usar `docker compose exec`.

## 7. Como registrar a avaliação

Para cada cenário, anote a rota, o papel usado, o resultado esperado, o status HTTP real e `PASSOU` ou `FALHOU`. Um teste passa quando o código HTTP, o conteúdo importante da resposta e a regra de negócio estão corretos.

Os testes automatizados dão evidência apenas para os cenários executados. Registre o resultado real de cada comando e do run do GitHub Actions correspondente ao commit avaliado; nenhum conjunto de testes substitui a verificação dos critérios de aceite das User Stories. Os nove épicos e as 41 User Stories permanecem descritos integralmente em [Épicos e User Stories](epicos-e-user-stories.md).
