# 04 — Regras de negócio

As regras a seguir consolidam o domínio herdado da AV1 e as decisões aprovadas especificamente para a AV2. O código legado é referência do comportamento de negócio, não base de implementação.

## 1. Organizações

1. `razaoSocial` não pode ser vazia.
2. CNPJ é normalizado para 14 dígitos, validado pelos dígitos verificadores e único.
3. Inscrição estadual, endereço, telefone e e-mail são opcionais; quando informados, devem ser validados conforme o formato definido para o campo.
4. Não permitir atualizar uma organização desativada.
5. Não permitir desativar organização que possua qualquer lote não finalizado (`statusProcessamento != FINALIZADO`); retornar conflito `409`.
6. Contrato vigente, sozinho, não bloqueia a desativação da organização; os contratos e lotes históricos são preservados.
7. Reativar apenas organização desativada, sem apagar histórico.

## 2. Contratos

1. Contrato só pode ser criado para organização existente e ativa.
2. `dataVencimento` deve ser uma data válida posterior ao instante de criação.
3. `valorMensal` deve ser decimal não negativo.
4. Cláusulas são lista de textos; `renovacaoAutomatica` não dispara tarefa automática nesta AV2.
5. Pode haver vários contratos históricos, mas no máximo um contrato vigente por organização. O status exposto é derivado: `CANCELADO` se `ativo=false` ou houver `dataCancelamento`; `VENCIDO` se não cancelado e `dataVencimento` não for futura; `VIGENTE` se ativo, sem cancelamento e com vencimento futuro.
6. Criar novo contrato enquanto outro estiver vigente gera `409`, exceto no fluxo transacional explícito de renovação.
7. Renovação fecha o contrato anterior e cria um novo registro na mesma transação. O novo vencimento deve ser posterior ao vencimento anterior; o histórico antigo permanece.
8. Contrato cancelado não pode ser atualizado nem renovado. Cancelamento repetido retorna `409`.
9. A tentativa de consultar contrato por rota aninhada deve confirmar que ele pertence à organização indicada; caso contrário, responder `404`.

## 3. Lotes

1. Lote exige organização existente e ativa.
2. `notaFiscal` e `transportadora` são obrigatórios e não vazios; observações são opcionais.
3. `dataEntrada` não pode ser futura nem anterior a 90 dias em relação ao momento da validação. O limite de 90 dias é inclusivo.
4. Estado inicial: `RECEBIDO` e `ativo=true`.
5. A sequência operacional permitida é `RECEBIDO → EM_TRIAGEM → TRIAGEM_CONCLUIDA → ENCAMINHADO → FINALIZADO`.
6. A operação de triagem só pode ocorrer no estágio permitido, exige lote ativo e pelo menos um equipamento.
7. A triagem mantém o comportamento simplificado da AV1: em uma transação única, o lote passa por `EM_TRIAGEM` e termina `TRIAGEM_CONCLUIDA`; cada equipamento do lote passa por `EM_TRIAGEM` e então `AGUARDANDO_DESMONTE`. O estado intermediário existe dentro da operação transacional; não haverá classificação individual de reaproveitamento/reciclagem/descarte nesta entrega.
8. Encaminhamento só ocorre após triagem concluída; finalização só ocorre após encaminhamento.
9. Lote desativado não pode ser processado; lote finalizado não pode ser alterado operacionalmente, nem ter a triagem refeita.
10. Não adicionar/remover equipamento de lote desativado ou finalizado. Remoção de vínculo só é permitida antes do estágio operacional que cria rastreabilidade e deve atualizar posição e vínculo de modo consistente.

## 4. Equipamentos

1. Equipamento deve ter tipo válido, marca e modelo não vazios, ano de fabricação inteiro entre 1900 e o ano atual, peso não negativo e valor de aquisição não negativo.
2. Estado físico inicial é informado no cadastro; status de rastreamento inicial é `AGUARDANDO_TRIAGEM`.
3. Código interno é gerado no servidor e único. Formato herdado recomendado: `GC-<prefixo de 4 caracteres do tipo>-<sequência com 6 dígitos>`. A geração deve ser segura contra colisão em requisições concorrentes; a unicidade do banco é a proteção final.
4. Só pode ser movimentado ou atualizado quando estiver ativo.
5. Mudanças de `statusRastreamento` exigem justificativa textual não vazia.
6. `EM_DESMONTE` só é permitido quando o estado atual é `AGUARDANDO_DESMONTE`.
7. A ordem de estados físicos é a listada em [03 — Modelo de dados](03-modelo-de-dados.md). Uma queda de duas ou mais categorias nessa ordem exige justificativa textual não vazia.
8. Uma mudança de estado físico também deve produzir o evento de histórico correspondente/auditoria.
9. Desativação é lógica; o equipamento e suas movimentações não podem ser removidos fisicamente. Equipamento desativado não pode ser atualizado ou movimentado até ser reativado.
10. Peso total do lote é calculado pela soma dos pesos dos equipamentos vinculados; não manter total duplicado como fonte de verdade.

## 5. Movimentações e rastreabilidade

1. Só registrar movimentação para equipamento existente e ativo.
2. O responsável é o usuário autenticado; o cliente não pode atribuir a operação a outro usuário.
3. `dataHora` é gerada pelo servidor em UTC.
4. `origem` é o último `destino` registrado para o equipamento; na primeira movimentação, usar o contexto inicial do lote. `destino` e `observacao` vêm do corpo validado.
5. Movimentação não altera automaticamente o estado de rastreamento; mudança de status exige a operação explícita própria.
6. O evento de movimentação é append-only. Corrigir informação histórica significa registrar evento corretivo conforme política explícita, nunca apagar o original.
7. Inserção de movimentação, atualização relacionada de equipamento e auditoria devem compartilhar a transação quando fizerem parte do mesmo caso de uso.

## 6. Cálculos e parâmetros

Defaults herdados da AV1:

- `aliquotaImpostoPercentual = 0`;
- `taxaDepreciacaoAnualPercentual = 15`.

Regras:

1. Ambos os parâmetros são percentuais de 0 a 100 e somente Administrador pode alterá-los.
2. Depreciação linear: `fatorResidual = max(0, 1 - taxaAnualDecimal × idadeEmAnos)`; `idadeEmAnos = max(0, anoAtual - anoFabricacao)`.
3. `valorResidual = valorAquisicao × fatorResidual`; arredondar dinheiro explicitamente a duas casas.
4. `impostosEstimados = receitaMensalBruta × aliquotaPercentual / 100`; `receitaLiquida = receitaBruta - impostosEstimados`.
5. Relatório por organização/período apresenta lotes encontrados, equipamentos, peso total e período consultado. Relatório por status apresenta quantidade de equipamentos e distribuição por tipo.
6. No relatório financeiro, o período do equipamento usa a data/hora da última movimentação; se não houver movimentação, usa o início do período como referência para a regra herdada. A receita mensal bruta soma contratos cuja assinatura/vigência cruza o período e que não estavam cancelados antes do início do intervalo.
7. `impostosEstimados = receitaMensalBruta × aliquotaImpostoPercentual / 100`; `receitaLiquida = receitaBruta - impostosEstimados`. Receita e valor residual são estimativas do relatório, não contabilização financeira ou garantia fiscal.
8. Mudanças de parâmetros são auditadas.

## 7. Auditoria e retenção

1. Registrar mutações de negócio e ações relevantes de segurança com ator, ação, entidade, instante, resultado e requestId quando disponível.
2. Se o evento de auditoria documenta sucesso de uma mutação, persistir ambos na mesma transação.
3. Nunca gravar senhas, hashes, tokens completos, segredos ou connection strings em detalhes de auditoria/log.
4. Eventos e movimentações são imutáveis por endpoints usuais.
5. Retenção mínima adotada para eventos históricos: 180 dias. Não excluir automaticamente antes desse prazo.

## 8. Concorrência e conflitos

1. Atualizações em recursos mutáveis exigem `versaoEsperada`.
2. Se a versão estiver obsoleta, a operação não persiste parcialmente e retorna `409 VERSION_CONFLICT`.
3. Incrementar `versao` na mesma transação da alteração.
4. Unicidade, mudança de contrato vigente, estados inválidos e bloqueios de desativação são conflitos `409`.
5. Erros de entrada são `400`; recurso ausente é `404`; ausência de autenticação é `401`; permissão insuficiente é `403`.
