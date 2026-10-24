# 07 — Épicos e User Stories da AV2

**Escopo aprovado:** `ENT1-A`. P0 é parte obrigatória do núcleo da entrega. P1 reúne capacidades complementares priorizadas após o núcleo, mas não está automaticamente excluído. A triagem da AV2 continua simplificada.

**Como ler este documento:** cada US registra o que o sistema deve fazer e como reconhecer o comportamento esperado. Isso descreve o requisito, não significa que ele já foi totalmente testado. Na validação local registrada, 25 testes unitários/HTTP e 10 de integração passaram; as histórias ainda precisam ser verificadas nos cenários que lhes correspondem. A aprovação da CI remota também deve ser conferida separadamente.

## E0 — Fundação HTTP, configuração e arquitetura

**Objetivo:** iniciar um monólito HTTP reproduzível, com camadas e erros consistentes.

### US-AV2-001 (P0) — Inicializar servidor HTTP
Como desenvolvedor, quero iniciar o Fastify com host/porta configuráveis para executar a API localmente e em CI.

**Aceite:** porta validada; `GET /health` responde; falhas de inicialização são claras; encerramento fecha o servidor e o Prisma de forma graciosa.

### US-AV2-002 (P0) — Separar camadas
Como mantenedor, quero controllers, services e repositories separados para preservar coesão e facilitar manutenção.

**Aceite:** controllers não acessam Prisma; services não dependem de `request`/`reply`; repositories encapsulam persistência; regras de negócio vivem nos services.

### US-AV2-003 (P0) — Padronizar validação e erros
Como consumidor da API, quero erros JSON previsíveis para tratar entrada inválida, autenticação, autorização, ausência, conflito e falhas internas.

**Aceite:** schemas de entrada; envelope de erro uniforme; status HTTP coerentes; sem stack trace ou segredo em resposta pública.

### US-AV2-004 (P0) — Configurar ambientes com segurança
Como desenvolvedor, quero exemplos de variáveis sem segredos versionados para preparar local e CI.

**Aceite:** `.env.example`; `.env` ignorado; configuração obrigatória validada; não há credenciais padrão de produção.

## E1 — Persistência relacional, Prisma e dados de desenvolvimento

**Objetivo:** criar um banco reproduzível com integridade referencial.

### US-AV2-005 (P0) — Definir schema Prisma
Como equipe, quero modelar usuário, organização, contrato, lote, equipamento, movimentação e modelos transversais.

**Aceite:** tipos, nulabilidade, relações, enums, índices e unicidades documentados; `prisma validate` passa.

### US-AV2-006 (P0) — Versionar migrações
Como desenvolvedor, quero recriar a estrutura do banco por migrações versionadas.

**Aceite:** banco vazio criado por migrações; SQL versionado; não há reset destrutivo automático em ambiente de entrega.

### US-AV2-007 (P0) — Integrar Prisma Client
Como service, quero acessar PostgreSQL com instância reutilizável e tipada.

**Aceite:** URL vem de ambiente; conexão centralizada; disconnect no encerramento; services usam repositories.

### US-AV2-008 (P1) — Criar seed repetível
Como desenvolvedor/testador, quero parâmetros e dados de desenvolvimento reproduzíveis.

**Aceite:** política idempotente documentada; defaults globais carregados; Administrador inicial só criado com variáveis bootstrap explícitas; credenciais exclusivas de desenvolvimento.

### US-AV2-009 (P0) — Garantir integridade no banco
Como responsável pelos dados, quero unicidade e chaves estrangeiras para impedir duplicidades e registros órfãos.

**Aceite:** CNPJ, login e código interno únicos; referências obrigatórias válidas; conflitos conhecidos mapeados a erros estáveis.

## E2 — Autenticação, usuários e autorização por papel

**Objetivo:** proteger endpoints e administrar contas sem expor credenciais.

### US-AV2-010 (P0) — Autenticar por usuário e senha
Como usuário, quero obter JWT após login válido para chamar endpoints protegidos.

**Aceite:** bcrypt; JWT de 30 minutos com `sub`, papel e `jti`; falha genérica para usuário inexistente/senha errada; usuário desativado não entra.

### US-AV2-011 (P0) — Validar tokens nas rotas
Como sistema, quero recusar tokens ausentes, inválidos, expirados ou revogados.

**Aceite:** hook/plugin central; identidade tipada; `jti` consultado no banco; estado ativo do usuário verificado em cada requisição protegida.

### US-AV2-012 (P0) — Encerrar e revogar sessão JWT
Como usuário, quero fazer logout que invalide o token atual.

**Aceite:** persistir `jti` revogado; token deixa de funcionar imediatamente; comportamento idempotente documentado/testado.

### US-AV2-013 (P0) — Aplicar RBAC por operação
Como responsável pela segurança, quero restringir leitura e escrita segundo os quatro papéis.

**Aceite:** matriz explícita; autorização no servidor; testes de permitido/negado por rota e papel.

### US-AV2-014 (P1) — Administrar usuários
Como Administrador, quero criar, listar, consultar, atualizar, ativar/desativar usuários e redefinir senha.

**Aceite:** login único normalizado; hash nunca retornado; usuário desativado perde acesso; proibir auto-desativação e desativação do último Administrador ativo.

### US-AV2-015 (P1) — Consultar e alterar a própria conta
Como usuário, quero consultar meus dados e trocar a senha.

**Aceite:** autenticação obrigatória; senha atual verificada; senha nova atende política; tokens anteriores revogados.

## E3 — Organizações

**Objetivo:** manter cadastro e ciclo administrativo sem perder histórico.

### US-AV2-016 (P0) — Criar organização
Como Operador de Cadastro, quero cadastrar uma organização para registrar um cliente.

**Aceite:** razão social e CNPJ obrigatórios; CNPJ com dígitos validadores e único após normalização; opcionais validados quando informados.

### US-AV2-017 (P0) — Consultar, listar e pesquisar organizações
Como usuário autorizado, quero localizar organizações por ID, texto e estado ativo.

**Aceite:** paginação/ordenação documentadas; filtros validados; lista vazia usa `data: []`; dados respeitam RBAC.

### US-AV2-018 (P0) — Atualizar organização
Como Operador de Cadastro, quero alterar campos permitidos.

**Aceite:** organização ativa; validações de campo; unicidade de CNPJ; `versaoEsperada`; conflito obsoleto retorna `409`.

### US-AV2-019 (P1) — Desativar e reativar organização
Como usuário autorizado de cadastro, quero controlar a organização sem apagar o histórico.

**Aceite:** desativação bloqueada por lote não finalizado; contrato vigente isolado não bloqueia; relações históricas mantidas.

## E4 — Contratos e histórico contratual

**Objetivo:** gerenciar vigência, renovação e cancelamento de forma rastreável.

### US-AV2-020 (P0) — Criar contrato
Como Operador de Cadastro, quero associar contrato a organização existente.

**Aceite:** organização ativa; vencimento futuro; valor mensal não negativo; apenas um contrato vigente; criação e auditoria consistentes.

### US-AV2-021 (P0) — Consultar e listar contratos
Como usuário autorizado, quero consultar contratos atuais e históricos.

**Aceite:** ID, organização, estado de vigência e intervalo de vencimento filtráveis; rota aninhada verifica pertencimento; histórico preservado.

### US-AV2-022 (P1) — Atualizar e renovar contrato
Como Operador de Cadastro, quero atualizar campos permitidos ou renovar a vigência sem sobrescrever o passado.

**Aceite:** renovação fecha o registro anterior e cria outro na mesma transação; novo vencimento é posterior ao vencimento anterior; evento auditável; somente um vigente.

### US-AV2-023 (P0) — Cancelar contrato sem apagar histórico
Como Operador autorizado, quero cancelar o contrato e preservar sua história.

**Aceite:** gravar `dataCancelamento`; não cancelar duas vezes; contrato cancelado não pode ser editado/renovado; histórico e relações ficam preservados.

## E5 — Lotes e ciclo operacional

**Objetivo:** registrar recebimento e proteger as transições do processo.

### US-AV2-024 (P0) — Criar lote
Como Gestor de Almoxarifado, quero registrar lote ligado a organização ativa.

**Aceite:** nota fiscal/transportadora não vazias; dataEntrada não futura e no máximo 90 dias anterior; status inicial `RECEBIDO`; `versao=1`.

### US-AV2-025 (P0) — Listar, buscar e atualizar lote
Como Gestor, quero consultar e atualizar os campos operacionais permitidos.

**Aceite:** filtros por organização/status/período/texto; não atualizar lote desativado ou finalizado; vínculo de organização válido.

### US-AV2-026 (P0) — Processar triagem simplificada
Como Gestor, quero aplicar a triagem herdada aos equipamentos do lote.

**Aceite:** lote ativo e não vazio; uma transação atualiza lote e todos os equipamentos; lote termina `TRIAGEM_CONCLUIDA`; cada equipamento termina `AGUARDANDO_DESMONTE`; não há classificação individual nesta entrega.

### US-AV2-027 (P1) — Encaminhar, finalizar, ativar/desativar lote
Como Gestor autorizado, quero executar ações de ciclo de vida válidas.

**Aceite:** encaminhar apenas após triagem concluída; finalizar apenas após encaminhamento; ações repetidas/fora de ordem geram `409`; desativação lógica preserva dados.

### US-AV2-028 (P1) — Gerenciar vínculo de equipamentos no lote
Como Gestor, quero corrigir vínculo/posição quando permitido.

**Aceite:** não alterar lote desativado/finalizado; não remover vínculo depois de iniciado o processamento/rastreabilidade; posições consistentes; schema e migração devem suportar a regra escolhida.

## E6 — Equipamentos, estados e código interno

**Objetivo:** cadastrar e acompanhar cada equipamento aplicando regras de estado.

### US-AV2-029 (P0) — Cadastrar equipamento
Como Gestor, quero cadastrar equipamento ligado a lote.

**Aceite:** enum de tipo/estado válido; marca/modelo não vazios; ano entre 1900 e ano corrente; peso e valor não negativos; código único gerado no servidor; status inicial `AGUARDANDO_TRIAGEM`.

### US-AV2-030 (P0) — Consultar, listar, pesquisar e atualizar equipamento
Como Gestor autorizado, quero consultar e manter atributos permitidos.

**Aceite:** filtros por lote/tipo/estado/status/texto; recursos desativados não podem ser alterados; não aceitar campos derivados/controlados pelo servidor.

### US-AV2-031 (P0) — Alterar estado físico ou status de rastreamento
Como Gestor, quero mudar estados somente por operações explícitas e válidas.

**Aceite:** mudança de rastreamento sempre exige justificativa; queda de pelo menos duas categorias físicas exige justificativa; não entrar em `EM_DESMONTE` antes de `AGUARDANDO_DESMONTE`; versão e evento histórico atualizados.

### US-AV2-032 (P1) — Desativar e reativar equipamento
Como Gestor, quero impedir operações em item sem apagar seu histórico.

**Aceite:** equipamentos desativados não são atualizados nem movimentados; reativação explícita; movimentações ficam preservadas.

### US-AV2-033 (P1) — Calcular peso, aquisição e depreciação
Como usuário autorizado, quero consultar dados calculados para relatórios.

**Aceite:** cálculo centralizado; taxa global aplicada; fator residual não negativo; dinheiro arredondado a duas casas; testes de limites.

## E7 — Movimentações e rastreabilidade

**Objetivo:** registrar a trajetória e impedir apagamento silencioso do histórico.

### US-AV2-034 (P0) — Registrar movimentação
Como Gestor autorizado, quero registrar destino/observação com ator e instante confiáveis.

**Aceite:** equipamento existente e ativo; ator vem do JWT; data/hora e origem vêm do servidor; criação do evento e auditoria correlata são atômicas; movimentação não altera status automaticamente.

### US-AV2-035 (P0) — Consultar histórico completo do equipamento
Como Administrador ou Auditor autorizado, quero visualizar movimentações em ordem cronológica.

**Aceite:** paginação e filtro por período/responsável; leitura somente; nenhum endpoint de alteração/exclusão de evento; autorização testada.

## E8 — Auditoria, relatórios, parâmetros e homologação

**Objetivo:** garantir rastreabilidade, indicadores e entrega reproduzível.

### US-AV2-036 (P1) — Auditar operações críticas
Como Auditor, quero consultar quem fez qual operação, em qual entidade e quando.

**Aceite:** mutações importantes e ações de segurança auditadas; evento contém ator/ação/entidade/instante/resultado; não registrar segredos; eventos append-only. A gravação da auditoria de mutação faz parte da transação.

### US-AV2-037 (P0) — Consultar relatórios operacionais básicos
Como usuário autorizado, quero indicadores por organização, período, lote e status.

**Aceite:** relatório por organização/período e por status; relatório de triagem; agregados consistentes com dados filtrados; RBAC aplicado. Relatório financeiro avançado pode ser simplificado e a limitação documentada.

### US-AV2-038 (P0) — Gerenciar parâmetros globais básicos
Como Administrador, quero consultar e alterar alíquota e taxa de depreciação.

**Aceite:** defaults 0% e 15%; valores de 0 a 100; só Administrador altera; mudança usa concorrência otimista e auditoria.

### US-AV2-039 (P0) — Documentar contrato da API
Como consumidor/desenvolvedor, quero OpenAPI/Swagger coerente com as rotas reais.

**Aceite:** schemas de request/response, auth, filtros, códigos HTTP e exemplos; Swagger permite autenticação de teste sem revelar segredos.

### US-AV2-040 (P0) — Testar API, banco, transações e RBAC
Como responsável pela qualidade, quero testes automáticos para comprovar as regras.

**Aceite:** casos positivos/negativos; constraints; permissões; rollback; versão concorrente; jornada organização→contrato→lote→equipamento→movimentação; token revogado.

### US-AV2-041 (P0) — Documentar instalação e homologação
Como responsável pela entrega, quero permitir reprodução e demonstrar o que foi validado.

**Aceite:** README, `.env.example`, ADRs, comandos de instalação/migração/seed/teste/execução; Windows e Ubuntu só marcados como homologados quando existir evidência real.

## Jornada mínima de demonstração

Esta sequência demonstra o caminho principal, mas não substitui o teste de cada critério de aceite nem os cenários negativos de permissão, concorrência e validação.


1. Preparar banco limpo e executar migrações/seed.
2. Autenticar usuário e verificar um endpoint protegido.
3. Criar organização com CNPJ válido.
4. Criar contrato e consultar seu histórico.
5. Criar lote com data válida e adicionar equipamento.
6. Processar triagem, encaminhar e finalizar lote.
7. Registrar movimentação e consultar rastreabilidade por papel autorizado.
8. Verificar relatório e evento de auditoria.
9. Demonstrar um acesso proibido, uma regra de negócio rejeitada e conflito de versão.
