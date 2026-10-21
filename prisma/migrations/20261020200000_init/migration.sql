-- Initial schema for GreenCode AV2. This migration is versioned; do not edit after applying to shared environments.
CREATE TYPE "PapelUsuario" AS ENUM ('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR');
CREATE TYPE "TipoEquipamento" AS ENUM ('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'ROTEADOR', 'CABO_ESTRUTURADO', 'FONTE_ALIMENTACAO');
CREATE TYPE "EstadoFisico" AS ENUM ('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'INSERVIVEL');
CREATE TYPE "StatusRastreamento" AS ENUM ('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO', 'BAIXA_DEFINITIVA');
CREATE TYPE "StatusProcessamentoLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO');

CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "usuario" VARCHAR(80) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "senhaHash" VARCHAR(255) NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcesso" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "usuarios_versao_check" CHECK ("versao" >= 1)
);
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");
CREATE INDEX "usuarios_ativo_papel_idx" ON "usuarios"("ativo", "papel");

CREATE TABLE "tokens_revogados" (
    "jti" VARCHAR(100) NOT NULL,
    "usuarioId" UUID NOT NULL,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "revogadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tokens_revogados_pkey" PRIMARY KEY ("jti")
);
CREATE INDEX "tokens_revogados_usuarioId_expiraEm_idx" ON "tokens_revogados"("usuarioId", "expiraEm");
CREATE INDEX "tokens_revogados_expiraEm_idx" ON "tokens_revogados"("expiraEm");

CREATE TABLE "organizacoes" (
    "id" UUID NOT NULL,
    "razaoSocial" VARCHAR(180) NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "inscricaoEstadual" VARCHAR(30),
    "enderecoCompleto" VARCHAR(300),
    "telefone" VARCHAR(30),
    "email" VARCHAR(254),
    "dataCadastro" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizacoes_cnpj_formato_check" CHECK ("cnpj" ~ '^[0-9]{14}$'),
    CONSTRAINT "organizacoes_versao_check" CHECK ("versao" >= 1)
);
CREATE UNIQUE INDEX "organizacoes_cnpj_key" ON "organizacoes"("cnpj");
CREATE INDEX "organizacoes_razaoSocial_idx" ON "organizacoes"("razaoSocial");
CREATE INDEX "organizacoes_ativo_idx" ON "organizacoes"("ativo");

CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "dataAssinatura" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataVencimento" TIMESTAMPTZ(3) NOT NULL,
    "clausulas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "valorMensal" DECIMAL(12,2) NOT NULL,
    "renovacaoAutomatica" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dataCancelamento" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contratos_valorMensal_check" CHECK ("valorMensal" >= 0),
    CONSTRAINT "contratos_versao_check" CHECK ("versao" >= 1)
);
CREATE INDEX "contratos_organizacaoId_dataVencimento_idx" ON "contratos"("organizacaoId", "dataVencimento");
CREATE INDEX "contratos_ativo_dataVencimento_idx" ON "contratos"("ativo", "dataVencimento");

CREATE TABLE "lotes" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "dataEntrada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notaFiscal" VARCHAR(100) NOT NULL,
    "transportadora" VARCHAR(120) NOT NULL,
    "statusProcessamento" "StatusProcessamentoLote" NOT NULL DEFAULT 'RECEBIDO',
    "observacoes" VARCHAR(2000) NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lotes_versao_check" CHECK ("versao" >= 1)
);
CREATE INDEX "lotes_organizacaoId_statusProcessamento_idx" ON "lotes"("organizacaoId", "statusProcessamento");
CREATE INDEX "lotes_dataEntrada_idx" ON "lotes"("dataEntrada");
CREATE INDEX "lotes_ativo_idx" ON "lotes"("ativo");

CREATE TABLE "equipamentos" (
    "id" UUID NOT NULL,
    "codigoBarrasInterno" VARCHAR(64) NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "marca" VARCHAR(100) NOT NULL,
    "modelo" VARCHAR(120) NOT NULL,
    "anoFabricacao" INTEGER NOT NULL,
    "estadoFisico" "EstadoFisico" NOT NULL,
    "pesoQuilogramas" DECIMAL(10,3) NOT NULL,
    "loteId" UUID NOT NULL,
    "posicaoNoLote" INTEGER NOT NULL,
    "statusRastreamento" "StatusRastreamento" NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "valorAquisicao" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "equipamentos_peso_check" CHECK ("pesoQuilogramas" >= 0),
    CONSTRAINT "equipamentos_valorAquisicao_check" CHECK ("valorAquisicao" >= 0),
    CONSTRAINT "equipamentos_anoFabricacao_check" CHECK ("anoFabricacao" BETWEEN 1900 AND 2100),
    CONSTRAINT "equipamentos_posicao_check" CHECK ("posicaoNoLote" >= 0),
    CONSTRAINT "equipamentos_versao_check" CHECK ("versao" >= 1)
);
CREATE UNIQUE INDEX "equipamentos_codigoBarrasInterno_key" ON "equipamentos"("codigoBarrasInterno");
CREATE UNIQUE INDEX "equipamentos_loteId_posicaoNoLote_key" ON "equipamentos"("loteId", "posicaoNoLote");
CREATE INDEX "equipamentos_loteId_statusRastreamento_idx" ON "equipamentos"("loteId", "statusRastreamento");
CREATE INDEX "equipamentos_tipo_estadoFisico_idx" ON "equipamentos"("tipo", "estadoFisico");
CREATE INDEX "equipamentos_ativo_idx" ON "equipamentos"("ativo");

CREATE TABLE "movimentacoes" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "dataHora" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" VARCHAR(180) NOT NULL,
    "destino" VARCHAR(180) NOT NULL,
    "responsavelId" UUID NOT NULL,
    "responsavelNomeSnapshot" VARCHAR(120) NOT NULL,
    "observacao" VARCHAR(2000) NOT NULL DEFAULT '',
    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "movimentacoes_equipamentoId_dataHora_idx" ON "movimentacoes"("equipamentoId", "dataHora");
CREATE INDEX "movimentacoes_responsavelId_dataHora_idx" ON "movimentacoes"("responsavelId", "dataHora");

CREATE TABLE "eventos_auditoria" (
    "id" UUID NOT NULL,
    "atorUsuarioId" UUID,
    "atorNomeSnapshot" VARCHAR(120),
    "acao" VARCHAR(80) NOT NULL,
    "entidade" VARCHAR(80) NOT NULL,
    "entidadeId" VARCHAR(100) NOT NULL,
    "instante" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" VARCHAR(30) NOT NULL,
    "requestId" VARCHAR(100),
    "detalhes" JSONB,
    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "eventos_auditoria_instante_idx" ON "eventos_auditoria"("instante");
CREATE INDEX "eventos_auditoria_entidade_entidadeId_instante_idx" ON "eventos_auditoria"("entidade", "entidadeId", "instante");
CREATE INDEX "eventos_auditoria_atorUsuarioId_instante_idx" ON "eventos_auditoria"("atorUsuarioId", "instante");

CREATE TABLE "parametros_globais" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'global',
    "aliquotaImpostoPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxaDepreciacaoAnualPercentual" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "atualizadoPorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "parametros_globais_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parametros_globais_id_check" CHECK ("id" = 'global'),
    CONSTRAINT "parametros_globais_aliquota_check" CHECK ("aliquotaImpostoPercentual" BETWEEN 0 AND 100),
    CONSTRAINT "parametros_globais_depreciacao_check" CHECK ("taxaDepreciacaoAnualPercentual" BETWEEN 0 AND 100),
    CONSTRAINT "parametros_globais_versao_check" CHECK ("versao" >= 1)
);

ALTER TABLE "tokens_revogados" ADD CONSTRAINT "tokens_revogados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "organizacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "eventos_auditoria" ADD CONSTRAINT "eventos_auditoria_atorUsuarioId_fkey" FOREIGN KEY ("atorUsuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parametros_globais" ADD CONSTRAINT "parametros_globais_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
