# GreenCode AV2

O GreenCode apoia o controle da logística reversa de equipamentos. Na AV1, o fluxo era operado por linha de comando; na AV2, as principais funções passam a ser acessadas por uma API REST, com banco de dados, usuários, permissões e histórico.

## Como executar

A forma preparada para avaliação é usar Docker Compose. Não é necessário instalar Node.js ou PostgreSQL diretamente no computador do avaliador. Instale e inicie o Docker Desktop no Windows ou o Docker Engine com o plugin Docker Compose no Ubuntu 24.04 ou superior.

Abra um terminal na raiz do projeto, onde estão `Dockerfile` e `docker-compose.yml`. Os comandos `docker compose` abaixo são iguais no PowerShell e no terminal do Ubuntu; somente a criação/configuração do arquivo `.env` e a consulta HTTP diferem.

### 1. Criar o arquivo `.env`

**Windows (PowerShell):**

```powershell
if (-not (Test-Path .\.env)) { Copy-Item .env.example .env }
```

**Ubuntu (Bash):**

```bash
if [ ! -f .env ]; then cp .env.example .env; fi
```

Os valores padrão de `.env.example` destinam-se exclusivamente à avaliação local e podem ser mantidos para uma demonstração isolada. Não os utilize em produção e não compartilhe nem versione `.env`. Se mudar `POSTGRES_PASSWORD`, use letras, números e `_` para evitar problemas de codificação na URL de conexão.

<!-- 146*39*61*010 duvido que alguem possa pensar nisso parte do meu RA-->

### 2. Gerar um segredo JWT aleatório

Gere um segredo aleatório e grave-o na linha `JWT_SECRET` do `.env`. Escolha o bloco referente ao terminal que está usando.

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

No Ubuntu, o comando usa `openssl`, normalmente disponível por padrão. Se o comando não existir, instale o pacote `openssl` pelo gerenciador da distribuição. Não precisa enviar o segredo para ninguém.

### 3. Validar, iniciar e conferir a aplicação

Estes comandos são iguais no PowerShell e no Bash: valide a configuração principal e a configuração do ambiente de testes, depois construa e inicie os serviços.

```shell
docker compose config -q
docker compose --profile tests config -q
docker compose up --build -d
docker compose ps
```

Aguarde `postgres` e `api` ficarem `healthy`. Se ainda estiverem `starting`, aguarde alguns segundos e execute `docker compose ps` novamente.

**Verificar a API no Windows (PowerShell):**

```powershell
Invoke-RestMethod http://localhost:3000/health
```

**Verificar a API no Ubuntu (Bash):**

```bash
curl --fail --show-error http://localhost:3000/health
```

A resposta deve conter `status: ok` e `service: greencode-api`. Também é possível abrir no navegador `http://localhost:3000/docs` para usar o Swagger ou `http://localhost:3000/docs/json` para consultar o contrato OpenAPI.

#### Executar comandos Prisma

A configuração do Docker Compose fornece a variável `DATABASE_URL` à API, usando o endereço interno do serviço PostgreSQL (`postgres:5432`). Por isso, execute os comandos Prisma dentro do container da API, depois que ele estiver iniciado. Não é necessário adicionar `DATABASE_URL` ao `.env.example` para esse fluxo.

Para validar o schema e gerar o Prisma Client:

```shell
docker compose exec api npm run prisma:validate
docker compose exec api npm run prisma:generate
```

Para aplicar as migrations pendentes e preparar os dados demonstrativos:

```shell
docker compose exec api npm run db:deploy
docker compose exec api npm run db:seed
```

Esses comandos utilizam o banco configurado para a aplicação. Não execute `docker compose down -v` como parte da rotina de validação, pois essa opção apaga os volumes do banco.

### Credenciais iniciais para uma avaliação limpa

Se manteve os valores de demonstração e está usando um volume de banco novo, use em `POST /api/v1/auth/login` no Swagger:

- Usuário: `admin_av2_local`
- Senha: `TroqueEstaSenhaLocal!2026`

Se alterou as variáveis `BOOTSTRAP_ADMIN_USERNAME` ou `BOOTSTRAP_ADMIN_PASSWORD`, use os valores definidos por você. O seed cria o administrador inicial somente se ele ainda não existir; se o volume já foi usado, o seed preserva as credenciais existentes e mudar o `.env` não redefine a senha de uma conta já criada.

O mesmo seed prepara uma massa demonstrativa de organizações, contratos, lotes e equipamentos com estados variados, além dos parâmetros globais. Os registros usam IDs e códigos reservados para demonstração: execuções repetidas não duplicam nem atualizam os registros já encontrados e não removem dados. Se houver colisão com um identificador reservado, o seed falha sem substituir o registro existente.

Para acompanhar a inicialização, execute `docker compose logs -f api`. Para parar sem apagar os dados, execute `docker compose down`. **Somente para descartar os dados locais e recomeçar do zero**, execute `docker compose down -v`; isso apaga os volumes do banco deste Compose. Depois, execute novamente `docker compose up --build -d`.

## O que o sistema cobre

A API gerencia usuários e permissões, organizações e contratos, lotes, equipamentos, movimentações, parâmetros globais, auditoria e relatórios básicos. A sequência principal é:

`Organização → Contrato → Lote → Equipamentos → Triagem → Encaminhamento → Finalização`.

## Documentação

- [Visão, história e arquitetura da AV2](docs/GreenCode-AV2.md)
- [Épicos e User Stories](docs/epicos-e-user-stories.md)
- [Guia de testes do professor](docs/guia-de-testes-professor.md)
- [Registros de decisões arquiteturais (ADRs)](docs/adr/README.md)

## Testes automatizados e CI

A validação manual pelo Swagger é complementar e não substitui os testes automatizados. **O professor pode executar as duas suítes usando Docker Compose, sem instalar Node.js nem PostgreSQL diretamente na máquina.** Os comandos abaixo funcionam tanto no PowerShell (Windows) quanto no Bash (Ubuntu), a partir da raiz do projeto, com o `.env` configurado conforme este README.

### 1. Testes unitários/HTTP

```shell
docker compose --profile tests run --rm --no-deps test-runner npm test
```

Esse comando constrói/usa a imagem do `test-runner`, executa o build TypeScript e roda os testes unitários/HTTP. A opção `--no-deps` evita iniciar o serviço PostgreSQL de testes, que não é necessário para esses casos.

### 2. Testes de integração com PostgreSQL

```shell
docker compose --profile tests run --rm test-runner
```

Esse comando aguarda o serviço `postgres-test`, aplica as migrações, executa o seed e roda `npm run test:integration`. A base é isolada (`greencode_test`). Não altere a URL para apontar ao banco principal de avaliação ou a um banco de produção.

Na execução local registrada em 25/10/2026, os testes unitários/HTTP terminaram com **25 testes aprovados e 0 falhas**, e os testes de integração com PostgreSQL terminaram com **13 testes aprovados e 0 falhas**. Também foram validadas a configuração e a geração do Prisma Client, a compilação TypeScript, a aplicação das migrations e duas execuções consecutivas da seed no banco principal. Por fim, `GET /health` retornou `status: ok` e `service: greencode-api`.

Esses resultados documentam a execução local nessa data. A contagem pode mudar quando novos testes forem adicionados; consulte sempre o resumo real dos comandos. Os testes aprovados fornecem evidência apenas dos cenários executados e não representam homologação automática de todas as User Stories.

### 3. Teste de fumaça Docker Compose no GitHub Actions

O workflow `.github/workflows/ci.yml` inclui um job que constrói a imagem, inicia PostgreSQL e API via Docker Compose em um runner Ubuntu e verifica `GET /health`. A configuração do workflow não prova que um run específico passou: após publicar alterações, confira o resultado do commit correspondente na aba Actions. O teste de fumaça não substitui os testes unitários/HTTP ou de integração.

Os testes aprovados dão evidência somente para os cenários executados; não representam homologação automática de todas as User Stories. Consulte também o [guia de testes do professor](docs/guia-de-testes-professor.md).


## Tecnologias principais

Node.js 24, TypeScript, Fastify 5, Prisma 7, PostgreSQL 17, JWT e Swagger/OpenAPI. O código é organizado em rotas/controllers, services, repositories e acesso ao banco.
