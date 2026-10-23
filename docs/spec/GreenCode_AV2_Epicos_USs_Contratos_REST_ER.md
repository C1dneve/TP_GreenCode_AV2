> **Nota de estado (20/10/2026):** este arquivo registra o backlog e o questionário como estavam antes do fechamento das decisões. As perguntas de domínio e de escopo foram respondidas; `docs/adr/ADR-0002-decisoes-dominio.md` é a fonte de verdade para as decisões aprovadas. Os itens de backlog ainda não implementados continuam sendo pendências de código, não perguntas de planejamento.

# GreenCode AV2 — Épicos, User Stories e decisões de API REST/Prisma

**Status:** backlog e questionário de domínio; decisões REST R1–R12 aprovadas em 20/10/2026  
**Base analisada:** PDF da AV2 e ZIP `GreenCode_AV1_Referencia_AV2_Dia1_Limpa.zip`  
**Repositório-alvo:** `C1dneve/TP_GreenCode_AV2`, branch de trabalho `feature/av2-monolith`  
**Atenção:** este documento é backlog e registro das perguntas de domínio. O contrato REST proposto após as escolhas R1–R12 está em [GreenCode_AV2_Contrato_REST_Proposto.md](GreenCode_AV2_Contrato_REST_Proposto.md). Nenhum dos dois arquivos é ainda o schema Prisma ou o OpenAPI definitivo.

## 0. Decisões já aprovadas — não reabrir sem impedimento novo

Estas decisões foram escolhidas anteriormente e são premissas deste backlog:

- Fastify; arquitetura Controller–Service–Repository; PostgreSQL local; API REST sem SPA completa nesta AV2.
- Os quatro papéis da AV1 permanecem como ponto de partida: Administrador, Operador de Cadastro, Gestor de Almoxarifado e Auditor; matriz RBAC inicial aprovada.
- Novo banco com seed e hashing adaptativo (bcrypt) para novas credenciais; não importar diretamente os arquivos cifrados da AV1.
- JWT com validade de 30 minutos, verificação do usuário ativo e revogação individual imediata pelo `jti` persistido; logout e revogação precisam ser testados.
- Transações nos fluxos críticos e controle otimista onde houver risco de atualização perdida.
- Preservar o histórico de contratos, com vários contratos por organização e no máximo um vigente por vez, como divergência deliberada a registrar em relação à simplificação do PDF.
- Preservar histórico por desativação/cancelamento, evitando exclusões físicas destrutivas.
- OpenAPI/Swagger, README, `.env.example`, ADRs e testes automatizados são entregáveis.
- Repositório separado `TP_GreenCode_AV2`; branch de desenvolvimento `feature/av2-monolith`; CI Ubuntu pelo GitHub Actions e Codespaces opcional para testes manuais.

O questionário REST R1–R12 foi respondido em 20/10/2026; consulte o contrato REST proposto para as decisões consolidadas. As perguntas restantes nas seções 4 e 5 focam o mapeamento Entidade–Relacionamento, o schema Prisma e comportamentos de domínio ainda não fechados.

## 1. Princípios de desenho

1. O PDF da AV2 é a referência do escopo técnico: servidor monolítico HTTP, API REST, Fastify recomendado, camadas Controller–Service–Repository, Prisma, banco relacional, autenticação JWT, transações, controle de concorrência, seed e API documentada.
2. O ZIP da AV1 é referência do domínio e dos comportamentos. A API não deve transportar menus, prompts ou persistência em arquivos para a arquitetura nova.
3. O sistema deve cobrir operações completas por entidade, e não apenas cadastro. Operações destrutivas devem respeitar relacionamentos e rastreabilidade; para contratos históricos, movimentações e auditoria, “CRUD completo” não implica apagar fatos históricos.
4. A proposta abaixo separa requisitos/validações já presentes na AV1 de decisões novas, que precisam de aprovação antes do schema Prisma.
5. Não importar a pasta `data/`, chaves, `.env`, dados de execução ou histórico Git da AV1. Novas credenciais são criadas por seed/desenvolvimento, com hash apropriado.

## 2. Épicos e User Stories

Prioridade: **P0** = necessário para uma AV2 funcional; **P1** = cobertura de domínio/qualidade recomendada; **P2** = melhoria a avaliar somente se couber no prazo.

### E0 — Fundação HTTP, configuração e arquitetura

**Objetivo:** deixar a aplicação como monólito HTTP configurável, com responsabilidades separadas.

- **US-AV2-001 (P0) — Inicializar servidor HTTP.** Como desenvolvedor, quero iniciar o Fastify com host/porta por ambiente, para executar a API localmente e em CI.
  - Aceite: porta validada e configurável; `/health` responde; erros de inicialização são claros; encerramento gracioso fecha recursos.
- **US-AV2-002 (P0) — Separar camadas.** Como mantenedor, quero rotas/controllers, services e repositories separados, para manter HTTP, regras de negócio e persistência desacoplados.
  - Aceite: controllers não chamam Prisma diretamente; services não dependem dos objetos de request/reply; repositories encapsulam as operações de banco.
- **US-AV2-003 (P0) — Padronizar validação e erros.** Como consumidor da API, quero erros JSON previsíveis, para diferenciar falhas de entrada, autenticação, autorização, ausência, conflito e falhas internas.
  - Aceite: schemas de entrada; status HTTP coerentes; nenhum stack trace ou segredo em resposta pública.
- **US-AV2-004 (P0) — Configurar ambientes com segurança.** Como desenvolvedor, quero exemplos de variáveis sem segredos versionados, para preparar local e CI com segurança.
  - Aceite: `.env.example`; `.env` ignorado pelo Git; configuração obrigatória validada na inicialização.

### E1 — Persistência relacional, Prisma e dados de desenvolvimento

**Objetivo:** modelar relações e garantir que o banco possa ser criado de forma reproduzível.

- **US-AV2-005 (P0) — Definir schema Prisma.** Como equipe, quero modelar usuários, organizações, contratos, lotes, equipamentos e movimentações, para representar o domínio com relações explícitas.
  - Aceite: tipos, nulabilidade, chaves estrangeiras, enums, índices e unicidades documentados; schema validado pelo Prisma.
- **US-AV2-006 (P0) — Versionar migrações.** Como desenvolvedor, quero recriar a estrutura do banco a partir de migrações, para evitar ajustes manuais não reproduzíveis.
  - Aceite: banco vazio preparado por migrações; migrações comitam junto do código; nenhuma sincronização destrutiva automática em produção.
- **US-AV2-007 (P0) — Integrar Prisma Client.** Como serviço, quero acessar PostgreSQL via uma instância reutilizável do Prisma Client, para persistir dados de forma tipada.
  - Aceite: conexão centralizada; encerramento fecha o client; connection string vem do ambiente.
- **US-AV2-008 (P1) — Criar seed repetível.** Como desenvolvedor/testador, quero carregar dados de desenvolvimento representativos, para executar os fluxos sem cadastros manuais.
  - Aceite: seed documentado, idempotente ou com política explícita de reset; inclui dados para testes de relações e estados variados; credenciais são somente de desenvolvimento.
- **US-AV2-009 (P0) — Garantir integridade no banco.** Como responsável pelos dados, quero unicidades e chaves estrangeiras, para impedir duplicidades e registros órfãos.
  - Aceite: CNPJ e código de barras interno são únicos; referências obrigatórias existem; conflitos de constraint são convertidos para respostas claras.

### E2 — Autenticação, usuários e autorização por papel

**Objetivo:** migrar a autenticação da CLI para JWT e proteger os endpoints no servidor.

- **US-AV2-010 (P0) — Autenticar por usuário e senha.** Como usuário, quero obter um JWT após autenticação válida, para chamar endpoints protegidos.
  - Aceite: senhas são verificadas com hash adaptativo; resposta não revela se usuário ou senha estavam incorretos; token contém subject e papel e tem expiração definida.
- **US-AV2-011 (P0) — Validar tokens nas rotas.** Como sistema, quero recusar JWT ausente, inválido, expirado ou revogado, para impedir acesso não autenticado.
  - Aceite: hook/plugin Fastify central; identidade autenticada fica tipada na requisição; endpoints públicos são explicitamente identificados.
- **US-AV2-012 (P0) — Encerrar e revogar sessão JWT.** Como usuário, quero fazer logout que invalide o token atual, para que ele não possa continuar sendo usado.
  - Aceite: revogação por `jti` persistida; token revogado recebe resposta de não autenticado; comportamento de expiração e usuário desativado coberto por teste.
- **US-AV2-013 (P0) — Aplicar RBAC por operação.** Como responsável pela segurança, quero restringir leitura e escrita conforme papel, para preservar a segregação de funções.
  - Aceite: Administrador, Operador de Cadastro, Gestor de Almoxarifado e Auditor têm matriz explícita; autorização aplicada no servidor; testes cobrem permitido/negado.
- **US-AV2-014 (P1) — Administrar usuários.** Como Administrador, quero criar, listar, consultar, atualizar, ativar/desativar usuários e redefinir senha, para gerenciar acesso.
  - Aceite: login único; hash nunca retornado; usuário desativado não autentica; não é permitido desativar o próprio usuário ou o último Administrador ativo.
- **US-AV2-015 (P1) — Consultar e alterar a própria conta.** Como usuário, quero consultar meus dados e trocar minha própria senha, para administrar minha conta sem privilégios administrativos.
  - Aceite: operação protegida; senha antiga verificada quando aplicável; sessões/tokens antigos tratados conforme política documentada.

### E3 — Organizações

**Objetivo:** cobrir o ciclo administrativo das organizações sem perder integridade com contratos e lotes.

- **US-AV2-016 (P0) — Criar organização.** Como Operador de Cadastro autorizado, quero cadastrar uma organização, para registrar um cliente de logística reversa.
  - Aceite: razão social, CNPJ e demais campos definidos validados; CNPJ válido por dígito verificador e único; campos opcionais explicitados.
- **US-AV2-017 (P0) — Consultar, listar e pesquisar organizações.** Como usuário autorizado, quero listar e filtrar organizações, para localizar registros.
  - Aceite: consulta por identificador; pesquisa de texto; filtros de estado ativo; paginação/ordenação conforme contrato aprovado; nenhuma informação não autorizada é retornada.
- **US-AV2-018 (P0) — Atualizar organização.** Como Operador de Cadastro autorizado, quero alterar os dados permitidos, para manter cadastros corretos.
  - Aceite: validações de campo; unicidade do CNPJ ao alterá-lo; erro de conflito quando registro não existe ou versão estiver obsoleta.
- **US-AV2-019 (P1) — Desativar e reativar organização.** Como Operador autorizado, quero desativar ou reativar uma organização, para controlar operações sem destruir histórico.
  - Aceite: desativação bloqueada enquanto houver lotes não finalizados, conforme regra da AV1; contratos e lotes históricos permanecem consultáveis por perfis autorizados.

### E4 — Contratos e histórico contratual

**Objetivo:** gerenciar vigência e cancelamento sem sobrescrever registros históricos.

- **US-AV2-020 (P0) — Criar contrato.** Como Operador de Cadastro, quero associar um contrato a uma organização existente, para registrar condições comerciais.
  - Aceite: organização existente; datas e valor mensal válidos; cláusulas e renovação automática tratados conforme decisão de modelo; regra de contrato vigente validada.
- **US-AV2-021 (P0) — Consultar e listar contratos.** Como usuário autorizado, quero consultar contratos atuais e históricos, para verificar vigência e condições.
  - Aceite: consulta por ID; filtros por organização, status/vigência e período; histórico preservado.
- **US-AV2-022 (P1) — Atualizar e renovar contrato.** Como Operador de Cadastro, quero alterar campos permitidos ou renovar a vigência, para manter as condições atuais.
  - Aceite: novo vencimento coerente; trilha de alterações; decisão documentada sobre renovar o mesmo registro ou criar novo contrato relacionado.
- **US-AV2-023 (P0) — Cancelar contrato sem apagar histórico.** Como Operador autorizado, quero cancelar contrato vigente, para encerrar a relação contratual de modo rastreável.
  - Aceite: não cancelar duas vezes; data de cancelamento registrada; histórico e relações preservados; somente um contrato vigente por organização, se confirmado na modelagem.

### E5 — Lotes e ciclo operacional

**Objetivo:** registrar recebimentos e proteger as transições do fluxo de logística reversa.

- **US-AV2-024 (P0) — Criar lote.** Como Gestor de Almoxarifado, quero registrar lote ligado a uma organização, para formalizar a entrada de materiais.
  - Aceite: organização existente; nota fiscal e transportadora validadas conforme campos aprovados; data de entrada dentro da janela de negócio herdada (não futura e não anterior a 90 dias, salvo decisão aprovada); estado inicial `RECEBIDO`.
- **US-AV2-025 (P0) — Listar, buscar e atualizar lote.** Como Gestor, quero consultar e atualizar os campos permitidos de um lote, para manter informações operacionais atualizadas.
  - Aceite: filtros por organização, status, período e texto; não alterar lote finalizado; referência inválida não persiste.
- **US-AV2-026 (P0) — Processar triagem.** Como Gestor, quero processar a triagem e classificar equipamentos, para identificar destino/reaproveitamento.
  - Aceite: estados do lote seguem transições válidas; operação atualiza lote e equipamentos de forma atômica quando relacionadas.
- **US-AV2-027 (P1) — Encaminhar, finalizar, ativar/desativar lote.** Como Gestor autorizado, quero executar ações de ciclo de vida válidas, para fechar etapas sem apagar dados.
  - Aceite: somente transições permitidas; lote finalizado não pode ser alterado em campos operacionais bloqueados; organização não é desativada enquanto houver outro lote pendente.
- **US-AV2-028 (P1) — Gerenciar vínculo de equipamentos no lote.** Como Gestor, quero associar/remover vínculo quando permitido, para corrigir a composição do lote sem perder entidades nem histórico.
  - Aceite: equipamento existente; lote ativo e não finalizado; rastreabilidade não é excluída silenciosamente; posição no lote é consistente se mantida.

### E6 — Equipamentos, estados e código interno

**Objetivo:** manter cadastro íntegro e aplicar as regras físicas/operacionais herdadas.

- **US-AV2-029 (P0) — Cadastrar equipamento.** Como Gestor, quero cadastrar equipamento vinculado a lote, para individualizar cada item.
  - Aceite: tipo/estado válidos; marca/modelo obrigatórios conforme domínio; ano e peso validados; valor de aquisição não negativo; código interno único; estado inicial `AGUARDANDO_TRIAGEM`.
- **US-AV2-030 (P0) — Consultar, listar, pesquisar e atualizar equipamento.** Como Gestor autorizado, quero consultar e manter atributos do equipamento, para corrigir dados sem perder rastreabilidade.
  - Aceite: filtros por lote, status, tipo e texto; atualização somente em campos permitidos; conflitos e recursos ausentes têm resposta consistente.
- **US-AV2-031 (P0) — Alterar estado físico ou status de rastreamento.** Como Gestor, quero mudar estados seguindo regras, para impedir fluxos operacionais inválidos.
  - Aceite: não entrar em desmonte sem triagem completa; queda de pelo menos duas categorias físicas exige justificativa; estado e histórico permanecem consistentes.
- **US-AV2-032 (P1) — Desativar e reativar equipamento.** Como Gestor, quero desativar/reativar item sem excluí-lo fisicamente, para controlar sua disponibilidade mantendo histórico.
  - Aceite: não movimentar nem atualizar item desativado sem reativação; relações e movimentações históricas mantidas.
- **US-AV2-033 (P1) — Calcular peso, aquisição e depreciação.** Como usuário autorizado, quero consultar dados calculados do equipamento e do lote, para obter indicadores operacionais/financeiros.
  - Aceite: cálculos centralizados em services; parâmetros e arredondamento documentados; testes de valores limites.

### E7 — Movimentações e rastreabilidade

**Objetivo:** registrar eventos de trajetória e impedir alteração silenciosa do histórico.

- **US-AV2-034 (P0) — Registrar movimentação.** Como Gestor autorizado, quero registrar origem, destino, responsável, observação e horário, para acompanhar a trajetória.
  - Aceite: equipamento existente e ativo; responsável identificado; evento e mudança de estado relacionadas persistem atomicamente quando aplicável.
- **US-AV2-035 (P0) — Consultar histórico completo do equipamento.** Como Auditor ou usuário operacional autorizado, quero visualizar as movimentações em ordem temporal, para rastrear a trajetória.
  - Aceite: filtro por intervalo/responsável conforme contrato REST aprovado; somente leitura; evento não pode ser apagado ou alterado silenciosamente.

### E8 — Auditoria, relatórios, parâmetros e homologação

**Objetivo:** preservar observabilidade de negócio e entregar uma API verificável/documentada.

- **US-AV2-036 (P1) — Auditar operações críticas.** Como Auditor, quero consultar quem fez qual operação, em qual entidade e quando, para apoiar rastreabilidade.
  - Aceite: registrar ator, ação, entidade, instante e resultado conforme decisão; não registrar senha, hash, JWT ou segredos; eventos não são editáveis por usuários comuns.
- **US-AV2-037 (P1) — Consultar relatórios operacionais.** Como usuário autorizado, quero consultar indicadores por organização, período e status, para acompanhar o fluxo operacional.
  - Aceite: totais consistentes com banco; filtros validados; papel limita os dados acessíveis.
- **US-AV2-038 (P1) — Gerenciar parâmetros globais.** Como Administrador, quero consultar/alterar alíquota e taxa anual de depreciação, para controlar cálculos sem mudar código.
  - Aceite: valores percentuais entre 0 e 100; apenas Administrador altera; mudanças auditadas.
- **US-AV2-039 (P0) — Documentar contrato da API.** Como desenvolvedor consumidor, quero OpenAPI/Swagger atualizado, para saber rotas, schemas, auth, respostas e exemplos.
  - Aceite: documentação confere com rotas reais; JWT configurável no UI; exemplos sem dados secretos.
- **US-AV2-040 (P0) — Testar API, banco, transações e RBAC.** Como responsável pela qualidade, quero testes unitários/de integração/E2E, para comprovar regras e evitar regressões.
  - Aceite: casos positivos/negativos; constraints; RBAC; rollback; conflito de concorrência; jornada organização→contrato→lote→equipamento→movimentação.
- **US-AV2-041 (P0) — Documentar instalação e homologação.** Como responsável pela entrega, quero README, ADRs e evidências de Windows/Ubuntu, para permitir reprodução e demonstrar limitações.
  - Aceite: comandos de instalação, configuração, migração, seed, teste e execução; cada SO só marcado validado com evidência real.

## 3. Perguntas para definir o contrato REST

Histórico do questionário: as alternativas e perguntas a seguir registram a etapa de decisão que levou às escolhas R1–R12 aprovadas em 20/10/2026. Para a especificação vigente proposta, consulte [GreenCode_AV2_Contrato_REST_Proposto.md](GreenCode_AV2_Contrato_REST_Proposto.md). As escolhas aprovadas orientam o contrato; a implementação e o OpenAPI final ainda precisam de validação nos testes.

### R1. Prefixo e versionamento
- **A (recomendado):** endpoints sob `/api/v1`.
- B: endpoints sem prefixo de versão.
- Pergunta: aprovamos `/api/v1`?

### R2. Nomenclatura de recursos
- **A (recomendado):** nomes plurais e kebab-case quando composto, por exemplo `/organizacoes`, `/contratos`, `/lotes`, `/equipamentos`, `/movimentacoes`.
- B: nomes singulares ou manter nomes da CLI.
- Pergunta: aprovamos recursos REST plurais, sem verbos de comando no nome do recurso?

### R3. Identificadores em URL
- A: manter IDs string legados/legíveis para todos os registros.
- **B (recomendado):** UUID para chave técnica nova e identificadores de negócio explícitos como CNPJ/código interno; não expor IDs sequenciais.
- C: cuid/ulid.
- Pergunta: qual padrão de ID usar para novos registros? CNPJ e `codigoBarrasInterno` continuam sendo identificadores de negócio, não substitutos automáticos da chave primária.

### R4. Envelope de resposta
- **A (recomendado):** objetos JSON diretos para recursos individuais e `{ data, meta }` para coleções paginadas.
- B: envelope `{ success, data, error }` em todas as respostas.
- Pergunta: qual formato uniforme adotar?

### R5. Formato de erro
- **A (recomendado):** `{ error: { code, message, details?, requestId? } }`.
- B: `{ success: false, message }`.
- Pergunta: aprovamos erro padronizado com código legível por máquina?

### R6. Listagens e paginação
- **A (recomendado):** `page`, `pageSize`, `sortBy`, `sortOrder`; limite padrão e máximo definidos; filtros por query string.
- B: cursor pagination desde o início.
- Pergunta: offset/page pagination é suficiente para o volume esperado da AV2?

### R7. Busca e filtros por entidade
- Organizações: `q` para razão social/CNPJ/contato e `ativo`.
- Contratos: `organizacaoId`, `status`, `vencimentoDe`, `vencimentoAte`.
- Lotes: `q`, `organizacaoId`, `status`, `dataEntradaDe`, `dataEntradaAte`, `ativo`.
- Equipamentos: `q`, `loteId`, `tipo`, `estadoFisico`, `statusRastreamento`, `ativo`.
- Movimentações: `equipamentoId`, `responsavelId`, `de`, `ate`.
- Pergunta: aprovamos esses filtros iniciais ou precisa de algum filtro essencial adicional?

### R8. Contratos aninhados ou recurso independente
- A (aninhado): `/organizacoes/:organizacaoId/contratos` para lista/criação e `/organizacoes/:organizacaoId/contratos/:contratoId` para detalhe.
- **B (recomendado): híbrido:** endpoints aninhados para operações que exigem o contexto da organização e `/contratos/:id` para operações por ID, renovação e cancelamento.
- C: somente `/contratos` como recurso independente.
- Pergunta: qual convenção preferimos?

### R9. Ciclo de vida versus PATCH genérico
- A: permitir `PATCH /lotes/:id` com status livre dentro dos enums.
- **B (recomendado):** dados editáveis usam `PATCH`; transições importantes usam subrotas de ação, como `POST /lotes/:id/triagem`, `POST /lotes/:id/encaminhamento`, `POST /lotes/:id/finalizacao`, e `POST /equipamentos/:id/movimentacoes`.
- Pergunta: aprovamos endpoints de ação para preservar pré-condições de negócio?

### R10. DELETE, desativação e cancelamento
- **A (recomendado):** `DELETE` não apaga fisicamente registros de negócio que precisam de histórico; usar `PATCH .../status` ou ações `POST .../desativacao`, `POST .../reativacao`, `POST /contratos/:id/cancelamento`.
- B: usar `DELETE` para indicar soft delete, documentando esse significado não convencional.
- Pergunta: aprovamos ações explícitas de ciclo de vida em vez de DELETE ambíguo?

### R11. Autenticação e conta
- Proposta: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`.
- A revogação imediata do JWT atual por `jti` já foi aprovada. A pergunta pendente é se aprovamos estes caminhos e nomes dos endpoints de autenticação/conta.

### R12. Códigos HTTP e conflitos
- Proposta: `201` criação, `200` consulta/atualização, `204` sucesso sem corpo quando apropriado, `400` entrada inválida, `401` sem token/token inválido, `403` sem permissão, `404` não encontrado, `409` duplicidade/conflito de versão/regra de estado, `422` se quisermos separar erro semântico de validação, `500` inesperado.
- Pergunta: aprovamos esta matriz, inclusive usar `409` para CNPJ duplicado e transição inválida/conflito concorrente?

## 4. Perguntas para o mapeamento Entidade–Relacionamento e schema Prisma

### E/R1. Chave primária
- A (recomendado): `String @id @default(uuid()) @db.Uuid` para chaves técnicas novas.
- B: String legível gerada pela aplicação (como os IDs da AV1).
- C: manter IDs de negócio como PK.
- Pergunta: aprovamos UUID como PK técnica? A decisão se aplica a todos os modelos novos, inclusive Usuário, Contrato, Lote, Equipamento e Movimentação.

### E/R2. Organização e Contrato: histórico versus “contrato opcional” do PDF — já decidido
O PDF descreve uma organização com um contrato opcional; a AV1 possui histórico de contratos. A decisão **já aprovada** é Organização `1:N` Contrato, permitindo vários históricos e no máximo um vigente de cada vez. Não é uma pergunta pendente. A divergência em relação à simplificação do PDF será registrada no ADR. O ponto ainda aberto é como representar e atualizar o estado de vigência, descrito em E/R3.

### E/R3. Como representar vigência contratual
- A: campos `ativo`, `dataVencimento`, `dataCancelamento`; vigente é calculado pela regra de negócio.
- **B (recomendado):** `status` explícito (`ATIVO`, `CANCELADO`, talvez `EXPIRADO`) mais datas, definindo claramente como expiração afeta status.
- Pergunta: usar status explícito? Como tratar vencimento automático sem job: considerar expirado por data no serviço ou atualizar status persistido?

### E/R4. Campos de Organização
Proposta baseada na AV1: `id`, `razaoSocial`, `cnpj`, `inscricaoEstadual`, `enderecoCompleto`, `telefone`, `email`, `dataCadastro`, `ativo`, `createdAt`, `updatedAt`, `versao`.
- Pergunta: manter `enderecoCompleto` como um campo ou decompor em logradouro, número, complemento, bairro, cidade, UF e CEP? Recomendação: manter campo único na AV2 para evitar expandir escopo sem requisito.
- Pergunta: quais campos são obrigatórios? Recomendação inicial: razão social e CNPJ obrigatórios; demais campos opcionais quando compatível com a regra atual.

### E/R5. Campos de Contrato e cláusulas
Proposta baseada na AV1: `id`, `organizacaoId`, `dataAssinatura`, `dataVencimento`, `clausulas`, `valorMensal`, `renovacaoAutomatica`, estado/status, `dataCancelamento`, `createdAt`, `updatedAt`, `versao`.
- A: `clausulas` como `String[]`/JSON no PostgreSQL.
- B: tabela `ClausulaContrato` separada com ordenação.
- Pergunta: cláusulas serão texto/lista simples ou precisarão de consultas e versionamento por cláusula? Recomendação inicial A.

### E/R6. Campos de Lote
Proposta baseada na AV1: `id`, `organizacaoId`, `dataEntrada`, `notaFiscal`, `transportadora`, `statusProcessamento`, `observacoes`, `ativo`, `createdAt`, `updatedAt`, `versao`.
- Pergunta: `notaFiscal` é única globalmente, única por organização ou não há regra de unicidade? Recomendação: não impor unicidade antes da regra comercial ser confirmada.
- Pergunta: há necessidade de número fiscal e série separadamente ou `notaFiscal` como texto existente é suficiente para a AV2?

### E/R7. Equipamentos e códigos
Proposta baseada na AV1: `id`, `codigoBarrasInterno`, `tipo`, `marca`, `modelo`, `anoFabricacao`, `estadoFisico`, `pesoQuilogramas`, `loteId`, `posicaoNoLote`, `statusRastreamento`, `ativo`, `valorAquisicao`, `createdAt`, `updatedAt`, `versao`.
- Pergunta: `codigoBarrasInterno` deve ser único globalmente? Recomendação: sim, conforme o PDF e a AV1.
- Pergunta: `posicaoNoLote` tem significado de negócio que precisa ser mantido? Recomendação: mantê-lo só se a ordem do equipamento dentro do lote for realmente usada; caso contrário, removê-lo.
- Pergunta: `anoFabricacao` pode ser desconhecido? Recomendação: confirmar se é obrigatório ou anulável.

### E/R8. Movimentação e responsável
Proposta baseada na AV1: `id`, `equipamentoId`, `dataHora`, `origem`, `destino`, `responsavel`, `observacao`.
- A: guardar só o texto do responsável como na AV1.
- **B (recomendado):** adicionar `responsavelId` como FK para `Usuario` e manter `responsavelNomeSnapshot` como fotografia histórica opcional.
- Pergunta: aprovamos B? Isso melhora a auditoria sem perder o nome histórico se o usuário trocar de nome ou for desativado.
- Pergunta: `origem`/`destino` continuam texto livre, ou devem referenciar localizações/entidades controladas? Recomendação inicial: texto livre, salvo requisito de negócio mais forte.

### E/R9. Usuários, papéis e status
Proposta: `Usuario` com `id`, `username`, `nome`, `senhaHash`, `papel`, `ativo`, `ultimoAcesso?`, `createdAt`, `updatedAt`, `versao`.
- Pergunta: manter papel único por usuário via enum, como na AV1, ou criar tabela de papéis/permissões? Recomendação: enum `PapelUsuario` com os quatro papéis para cumprir o prazo.
- Pergunta: `username` é case-insensitive/normalizado? Recomendação: armazenar uma forma normalizada e garantir unicidade, documentando as regras.

### E/R10. Revogação de JWT
Proposta: tabela `TokenRevogado` com `jti`, `usuarioId` ou subject, `expiraEm`, `revogadoEm`.
- Pergunta: manter registros revogados até que o JWT original expire e limpar depois? Recomendação: sim, com tarefa de limpeza opcional; a validação deve negar imediatamente tokens revogados.

### E/R11. Auditoria
Proposta: tabela `EventoAuditoria` com `id`, `atorUsuarioId?`, `atorNomeSnapshot`, `acao`, `entidade`, `entidadeId`, `instante`, `resultado`, `requestId?`, `detalhes` JSON restritos.
- Pergunta: auditoria será obrigatória para todas as mutações de negócio ou apenas ações críticas? Recomendação: todas as mutações importantes, autenticação/logout e alterações de permissões; sem gravar senhas, hashes, tokens ou segredos.
- Pergunta: ações de negócio e evento de auditoria devem ficar na mesma transação? Recomendação: sim quando o evento confirma a alteração; erro de auditoria deve impedir a mutação se auditoria for requisito de integridade.

### E/R12. Dinheiro, peso e timestamps
- A: valores monetários em `Float` e peso em `Float`.
- **B (recomendado):** `Decimal` para valor mensal e aquisição; `Decimal` ou `Float` para peso de acordo com a precisão necessária; timestamps em `DateTime` com persistência consistente em UTC.
- Pergunta: aprovamos `Decimal` para dinheiro e uma precisão definida para peso? Recomendação: evitar `Float` para dinheiro por erros de arredondamento.

### E/R13. Concorrência otimista e auditoria de atualização
- Proposta: `versao Int @default(1)` nas entidades mutáveis com edição concorrente; incrementar em cada atualização condicional.
- Pergunta: aplicar versão em Organização, Contrato, Lote e Equipamento; não em Movimentação/Auditoria por serem append-only? Recomendação: sim.

### E/R14. Exclusão e relações
- Pergunta: confirmar regra geral `onDelete: Restrict` para entidades de negócio com histórico, sem cascade destrutivo? Recomendação: sim; desativação/cancelamento lógico nas entidades onde a regra pede.
- Pergunta: movimentações e auditoria serão imutáveis e sem endpoint PUT/PATCH/DELETE? Recomendação: sim; correções por novo evento corretivo quando justificadas.

## 5. Perguntas adicionais de comportamento necessárias antes de fechar endpoints

1. **Janela de data do lote:** manter a regra da AV1 (não futuro e até 90 dias no passado) exatamente? Se mudou, qual regra?
2. **Desativação de organização:** bloquear quando houver lotes não finalizados como na AV1? E contrato vigente também bloqueia, gera aviso ou não interfere?
3. **Finalização de lote:** quais condições exatas tornam um lote finalizável? Todos equipamentos precisam estar em status final? Como lidar com lote vazio?
4. **Triagem:** a triagem recebe um resultado por equipamento no corpo de uma única requisição, ou será feita equipamento por equipamento?
5. **Movimentação:** cada registro de movimento muda automaticamente `origem` para o destino anterior e atualiza o estado/status, ou são conceitos distintos?
6. **Estado físico:** manter a ordem fixa `NOVO → BOM_ESTADO → USADO_LEVE → USADO_MODERADO → DANIFICADO_LEVE → DANIFICADO_GRAVE → INSERVIVEL` para calcular queda de duas categorias? Há exceções autorizadas?
7. **Código de barras:** o servidor gera o código automaticamente, ou o cliente pode enviar um código? Recomendação: geração no backend com unicidade garantida pelo banco.
8. **Relatórios:** o resumo por organização/status/finanças continua dentro da AV2? Quais perfis podem acessar o relatório financeiro?
9. **Parâmetros globais:** manter `aliquotaImpostoPercentual` e `taxaDepreciacaoAnualPercentual`; qual deve ser o valor inicial da taxa de depreciação (AV1 usava 15%)?
10. **Exclusão de usuário:** desativação impede login imediatamente e revoga todas as sessões ativas daquele usuário? Recomendação: sim.

## 6. Modelo recomendado para responder

Responder usando os códigos e letras, por exemplo:

```text
REST:
R1-A, R2-A, R3-B, R4-A, R5-A, R6-A, R7-A, R8-B, R9-B, R10-A, R11-Sim, R12-Sim

ER:
ER1-A, ER2-A, ER3-B, ER4-endereco único; razão social/CNPJ obrigatórios,
ER5-A, ER6-sem unicidade adicional, ER7-código único; remover posição se não usada,
ER8-B; origem/destino texto, ER9-enum + username normalizado,
ER10-sim, ER11-todas as mutações; mesma transação, ER12-B,
ER13-sim, ER14-sim

Regras:
1-manter 90 dias, 2-bloquear com lotes pendentes, ...
```

Pode responder “concordo com todas as recomendações” em cada grupo e marcar exceções. Depois das respostas, a próxima entrega será um contrato REST rascunho e um diagrama ER textual/visual antes de alterar o `schema.prisma` definitivo. Todas as divergências em relação ao PDF serão registradas com contexto, alternativas, decisão e motivo.
