# GreenCode AV2: história, estrutura e arquitetura

## O que é o GreenCode

O GreenCode apoia a logística reversa de equipamentos eletrônicos: registra organizações, contratos, lotes recebidos, equipamentos e movimentações, mantendo o histórico necessário para acompanhar o processo.

## Da AV1 para a AV2

A AV1 era uma aplicação operada por linha de comando e apoiada por arquivos locais. A AV2 mantém as entidades e as regras de negócio importantes, mas muda a forma de uso: agora o sistema expõe uma API REST acessada por HTTP e grava os dados em PostgreSQL.

A mudança também introduz autenticação por usuário, permissões por papel, uma trilha de auditoria no banco e documentação OpenAPI/Swagger. A entrega da AV2 é o backend; uma interface web completa (SPA) não faz parte deste escopo. Também não há classificação individual de cada equipamento em reaproveitamento, reciclagem e descarte durante a triagem: o processo desta versão é simplificado.

## O que o sistema faz

- Mantém usuários, seus papéis e o acesso autorizado às funções.
- Cadastra organizações e mantém o histórico de contratos, incluindo renovação e cancelamento.
- Registra lotes e equipamentos, controla os estados do processo e impede transições fora de ordem.
- Registra movimentações sem apagar o histórico anterior.
- Disponibiliza parâmetros globais, relatórios operacionais/financeiros essenciais e consulta de auditoria.

## Arquitetura em poucas palavras

O GreenCode AV2 é um **monólito modular**: a aplicação é entregue como um único serviço, mas o código é separado por responsabilidades e áreas de negócio.

```text
Cliente HTTP ou Swagger
          ↓
Rotas e controllers — recebem e respondem às requisições
          ↓
Services — aplicam as regras e coordenam as operações
          ↓
Repositories — consultam e gravam os dados
          ↓
Prisma
          ↓
PostgreSQL
```

As rotas validam o formato das entradas. Os controllers conectam HTTP aos casos de uso. Os services aplicam as regras de negócio e coordenam transações. Os repositories concentram o acesso aos dados. Isso evita que regras importantes fiquem espalhadas por endpoints diferentes. Os motivos e trade-offs da arquitetura e das escolhas de tecnologia estão formalizados nos [ADRs](adr/README.md).

### Tecnologias

- **Node.js 24 e TypeScript:** ambiente de execução e linguagem.
- **Fastify 5:** servidor HTTP e rotas da API.
- **Prisma 7:** acesso tipado ao banco e migrações versionadas.
- **PostgreSQL 17:** armazenamento principal dos dados.
- **JWT e bcrypt:** sessão autenticada e proteção de senhas.
- **Swagger/OpenAPI:** documentação interativa e contrato das rotas.
- **Docker Compose:** forma reproduzível de iniciar a API e o banco para avaliação.

## Organização do código

Dentro de `src/`, cada módulo concentra uma parte do sistema:

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, sessão, logout e troca de senha |
| `usuarios` | Cadastro, consulta e administração dos usuários |
| `organizacoes` | Organizações e validação de CNPJ |
| `contratos` | Vigência, renovação e histórico contratual |
| `lotes` | Recebimento, triagem, encaminhamento e finalização |
| `equipamentos` | Cadastro, condições físicas e estados de rastreamento |
| `movimentacoes` | Histórico de deslocamento dos equipamentos |
| `auditoria` | Consulta de eventos relevantes |
| `relatorios` | Indicadores operacionais e financeiros essenciais |
| `parametros` | Alíquota e taxa anual de depreciação |

Os testes ficam em `src/tests/`; o schema e as migrações ficam em `prisma/`. O arquivo `docker-compose.yml` descreve os serviços de execução da avaliação.

## Dados e relações principais

Uma organização pode ter vários contratos ao longo do tempo, mas apenas um contrato vigente de cada vez. Uma organização recebe lotes; cada lote pode conter vários equipamentos; cada equipamento mantém suas movimentações. Os eventos de auditoria registram operações importantes e seus responsáveis.

O banco também protege relações e valores únicos — por exemplo, login, CNPJ e código interno de equipamento. Isso evita duplicidades mesmo quando duas requisições chegam quase ao mesmo tempo.

## Regras que orientam o funcionamento

- O CNPJ é validado e não pode se repetir.
- A data de entrada de um lote não pode ser futura nem ter mais de 90 dias.
- O fluxo persistido do lote é `RECEBIDO → TRIAGEM_CONCLUIDA → ENCAMINHADO → FINALIZADO`; o início e a conclusão da triagem são tratados atomicamente na mesma operação.
- A triagem exige lote ativo e todos os equipamentos ativos em `AGUARDANDO_TRIAGEM`, sem falhas de concorrência. Ao concluí-la, o lote passa para `TRIAGEM_CONCLUIDA` e os equipamentos para `AGUARDANDO_DESMONTE`; cada versão é incrementada uma vez por essa alteração lógica.
- A desmontagem só pode começar depois de `AGUARDANDO_DESMONTE`.
- Mudanças de estado de rastreamento exigem justificativa. Uma degradação física de duas ou mais categorias também exige justificativa.
- Uma organização com lote não finalizado não pode ser desativada.
- Atualizações protegidas por versão usam `versaoEsperada`; uma versão antiga gera conflito e não deve deixar uma alteração parcial.
- Eventos de movimentação e auditoria preservam o histórico em vez de permitir apagamento comum.
- Os parâmetros globais iniciais são alíquota de imposto de 0% e depreciação anual de 15%.

## Usuários e permissões

A API possui quatro papéis:

| Papel | Uso principal |
|---|---|
| `ADMINISTRADOR` | Administração de usuários e acesso de gestão às demais áreas |
| `OPERADOR_CADASTRO` | Organizações e contratos |
| `GESTOR_ALMOXARIFADO` | Lotes, equipamentos e criação de movimentações |
| `AUDITOR` | Leitura de movimentações, auditoria e relatórios |

O acesso é verificado pelo servidor em cada requisição. O login retorna um JWT válido por 30 minutos. O logout revoga o token utilizado; uma troca ou redefinição de senha invalida as sessões anteriores. Senhas são armazenadas como hash bcrypt, nunca em texto puro.

O administrador inicial é configurado de forma explícita pelas variáveis `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME` e `BOOTSTRAP_ADMIN_PASSWORD`. Não há uma senha padrão embutida no código. O seed preserva as credenciais de um administrador que já exista no banco.

## Como ler os requisitos e o estado dos testes

O arquivo [Épicos e User Stories](epicos-e-user-stories.md) descreve o que a AV2 deve fazer e os critérios para aceitar cada história. A existência de uma história ou de código não prova, por si só, que ela foi homologada.

As evidências automatizadas estão separadas por objetivo: `npm test` executa testes unitários/HTTP; `npm run test:integration` executa testes contra uma base PostgreSQL dedicada; o job `docker-compose-smoke` do [workflow de CI](../.github/workflows/ci.yml) constrói e inicia a API e o banco com Docker Compose e verifica `GET /health`; a execução pelo Swagger é uma validação manual complementar. Os testes de integração recusam uma URL cujo nome de banco não contenha `test`.

A suíte inclui verificações de revogação real de JWT, concorrência otimista com versão obsoleta e rollback da triagem quando a auditoria falha. O teste de rollback instala um gatilho temporário somente na base de teste, verifica lote, equipamento e auditoria e remove o gatilho ao terminar. O [guia do professor](guia-de-testes-professor.md) contém os comandos e ressalvas. Um teste aprovado comprova somente o cenário coberto; não equivale à homologação de todas as 41 User Stories.
