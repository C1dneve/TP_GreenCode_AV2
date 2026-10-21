# 01 — Visão geral e escopo

## 1. Objetivo

A AV2 evolui o GreenCode da CLI da AV1 para uma aplicação monolítica de servidor HTTP que expõe uma API REST, persiste dados em banco relacional e suporta múltiplos usuários autenticados.

A API é a entrega central. Uma SPA completa não faz parte do escopo atual; o sistema será validado por Swagger/OpenAPI, cliente HTTP e testes automatizados.

## 2. Escopo aprovado

A decisão `ENT1-A` foi aprovada pelo responsável em 20/10/2026:

- preservar os fluxos essenciais e as regras de negócio da AV1;
- implementar gestão de usuários e autorização, organizações, contratos, lotes, equipamentos e movimentações;
- preservar histórico e trilha de auditoria;
- incluir relatórios operacionais/de triagem e parâmetros globais básicos;
- manter relatório financeiro em forma essencial, podendo simplificar o relatório financeiro avançado se o prazo exigir, documentando a limitação;
- entregar API documentada, testes, migrações, seed de desenvolvimento, `.env.example`, ADRs e instruções reproduzíveis.

`P0` significa requisito obrigatório do núcleo funcional. `P1` significa capacidade complementar priorizada depois que o núcleo estiver estável; itens P1 não estão automaticamente excluídos. Qualquer corte deve ser registrado no README/ADR e refletido nos testes e no OpenAPI.

## 3. Herança da AV1

### Preservar

- entidades de organização, contrato, lote, equipamento e movimentação;
- quatro papéis: `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`;
- validação de dígitos verificadores e unicidade do CNPJ;
- janela de data de entrada do lote de até 90 dias para trás, sem datas futuras;
- estados de lote, estados físicos e estados de rastreamento;
- justificativa para mudança de status de rastreamento e para degradação de pelo menos duas categorias físicas;
- impedimento de desmonte antes da triagem;
- restrição de desativação de organização com lotes não finalizados;
- códigos internos únicos, movimentações, relatórios e parâmetros de negócio;
- desativação lógica e rastreabilidade dos eventos importantes.

### Não transportar para a AV2

- menus, comandos, prompts e autocomplete da CLI;
- persistência em arquivos cifrados, journal em arquivo e atomicidade por renomeação;
- arquivos de configuração privilegiados, dados locais, senhas, hashes ou sessões da AV1;
- histórico Git da AV1.

Credenciais novas são cadastradas no banco e armazenadas com hash adaptativo bcrypt. A sessão da API usa JWT de 30 minutos com revogação persistida por `jti`.

## 4. Stack aprovada

- Node.js 24 LTS e TypeScript;
- Fastify 5;
- Prisma ORM 7, com driver adapter para PostgreSQL;
- PostgreSQL 17 ou compatível;
- Swagger/OpenAPI;
- GitHub Actions/CI, migrações versionadas e seed explícito.

## 5. Fluxo principal

`Usuário autenticado → Organização → Histórico de contratos → Lote → Equipamentos → Movimentações → Relatórios/Auditoria`.

Um lote pertence a uma organização; cada equipamento pertence a um lote quando vinculado; um equipamento possui histórico de movimentações; cada movimentação identifica o responsável autenticado e preserva um snapshot do nome.

## 6. Critério de sucesso da atividade

Uma instalação limpa deve conseguir configurar o ambiente, criar a estrutura do banco por migrações versionadas, preparar dados de desenvolvimento, iniciar a API, autenticar-se, executar a jornada central de negócio e consultar o histórico, respeitando a autorização por papel e as regras de domínio.
