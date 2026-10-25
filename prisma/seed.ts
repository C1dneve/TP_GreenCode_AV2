import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EstadoFisico, type StatusProcessamentoLote, type StatusRastreamento, type TipoEquipamento } from "../src/generated/prisma/client.js";
import { getBootstrapAdminConfig } from "../src/config/bootstrap-admin.js";

type SeedTransaction = Pick<PrismaClient, "organizacao" | "contrato" | "lote" | "equipamento" | "parametroGlobal" | "usuario">;

type DemoOrganization = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string | null;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  ativo: boolean;
};

type DemoContract = {
  id: string;
  organizacaoId: string;
  dataAssinatura: Date;
  dataVencimento: Date;
  clausulas: string[];
  valorMensal: string;
  renovacaoAutomatica: boolean;
  ativo: boolean;
  dataCancelamento: Date | null;
};

type DemoLot = {
  id: string;
  organizacaoId: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  statusProcessamento: StatusProcessamentoLote;
  observacoes: string;
  ativo: boolean;
};

type DemoEquipment = {
  id: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: string;
  loteId: string | null;
  posicaoNoLote: number | null;
  statusRastreamento: StatusRastreamento;
  ativo: boolean;
  valorAquisicao: string;
};

// IDs e códigos DEMO-AV2 são reservados para a massa demonstrativa. O seed
// nunca atualiza nem remove registros existentes; colisões são interrompidas.
const DEMO_ORGANIZATIONS: DemoOrganization[] = [
  {
    id: "a2a00001-0000-4000-8000-000000000001",
    razaoSocial: "VerdeLog Tecnologia e Serviços Ltda.",
    cnpj: "99000000000159",
    inscricaoEstadual: "ISENTO",
    enderecoCompleto: "Av. da Sustentabilidade, 120 - São José dos Campos/SP",
    telefone: "+55 12 3000-0001",
    email: "contato@verdelog.example.test",
    ativo: true,
  },
  {
    id: "a2a00001-0000-4000-8000-000000000002",
    razaoSocial: "Instituto de Recondicionamento Digital",
    cnpj: "99000000000230",
    inscricaoEstadual: null,
    enderecoCompleto: "Rua da Reciclagem, 45 - Jacareí/SP",
    telefone: "+55 12 3000-0002",
    email: "operacoes@recondicionamento.example.test",
    ativo: true,
  },
  {
    id: "a2a00001-0000-4000-8000-000000000003",
    razaoSocial: "Rede Escolar Sustentável S.A.",
    cnpj: "99000000000310",
    inscricaoEstadual: "ISENTO",
    enderecoCompleto: "Praça do Conhecimento, 80 - Taubaté/SP",
    telefone: "+55 12 3000-0003",
    email: "infra@redeescolar.example.test",
    ativo: true,
  },
  {
    id: "a2a00001-0000-4000-8000-000000000004",
    razaoSocial: "Organização Arquivada de Demonstração",
    cnpj: "99000000000400",
    inscricaoEstadual: null,
    enderecoCompleto: "Rua dos Registros, 10 - São José dos Campos/SP",
    telefone: "+55 12 3000-0004",
    email: "arquivo@organizacao-demo.example.test",
    ativo: false,
  },
];

function dateRelativeToToday(offsetDays: number): Date {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value;
}

const DEMO_CONTRACTS: DemoContract[] = [
  {
    id: "a2b00001-0000-4000-8000-000000000001",
    organizacaoId: DEMO_ORGANIZATIONS[0]!.id,
    dataAssinatura: dateRelativeToToday(-45),
    dataVencimento: dateRelativeToToday(320),
    clausulas: ["Destinação ambientalmente adequada", "Comprovante de recebimento por lote"],
    valorMensal: "1250.00",
    renovacaoAutomatica: true,
    ativo: true,
    dataCancelamento: null,
  },
  {
    id: "a2b00001-0000-4000-8000-000000000002",
    organizacaoId: DEMO_ORGANIZATIONS[1]!.id,
    dataAssinatura: dateRelativeToToday(-30),
    dataVencimento: dateRelativeToToday(180),
    clausulas: ["Triagem simplificada", "Relatório mensal de materiais encaminhados"],
    valorMensal: "850.00",
    renovacaoAutomatica: false,
    ativo: true,
    dataCancelamento: null,
  },
  {
    id: "a2b00001-0000-4000-8000-000000000003",
    organizacaoId: DEMO_ORGANIZATIONS[2]!.id,
    dataAssinatura: dateRelativeToToday(-20),
    dataVencimento: dateRelativeToToday(90),
    clausulas: ["Coleta programada", "Rastreabilidade dos equipamentos"],
    valorMensal: "560.00",
    renovacaoAutomatica: true,
    ativo: true,
    dataCancelamento: null,
  },
  {
    id: "a2b00001-0000-4000-8000-000000000004",
    organizacaoId: DEMO_ORGANIZATIONS[3]!.id,
    dataAssinatura: dateRelativeToToday(-240),
    dataVencimento: dateRelativeToToday(-60),
    clausulas: ["Contrato histórico de demonstração"],
    valorMensal: "300.00",
    renovacaoAutomatica: false,
    ativo: false,
    dataCancelamento: dateRelativeToToday(-30),
  },
];

const DEMO_LOTS: DemoLot[] = [
  {
    id: "a2c00001-0000-4000-8000-000000000001",
    organizacaoId: DEMO_ORGANIZATIONS[0]!.id,
    dataEntrada: dateRelativeToToday(-2),
    notaFiscal: "DEMO-AV2-NF-0001",
    transportadora: "EcoTrans Logística",
    statusProcessamento: "RECEBIDO",
    observacoes: "Lote recebido; aguardando conferência e triagem.",
    ativo: true,
  },
  {
    id: "a2c00001-0000-4000-8000-000000000002",
    organizacaoId: DEMO_ORGANIZATIONS[0]!.id,
    dataEntrada: dateRelativeToToday(-5),
    notaFiscal: "DEMO-AV2-NF-0002",
    transportadora: "EcoTrans Logística",
    statusProcessamento: "EM_TRIAGEM",
    observacoes: "Triagem iniciada; conferência física em andamento.",
    ativo: true,
  },
  {
    id: "a2c00001-0000-4000-8000-000000000003",
    organizacaoId: DEMO_ORGANIZATIONS[1]!.id,
    dataEntrada: dateRelativeToToday(-12),
    notaFiscal: "DEMO-AV2-NF-0003",
    transportadora: "Circular Vale Transportes",
    statusProcessamento: "TRIAGEM_CONCLUIDA",
    observacoes: "Triagem concluída; equipamentos aguardam encaminhamento.",
    ativo: true,
  },
  {
    id: "a2c00001-0000-4000-8000-000000000004",
    organizacaoId: DEMO_ORGANIZATIONS[1]!.id,
    dataEntrada: dateRelativeToToday(-20),
    notaFiscal: "DEMO-AV2-NF-0004",
    transportadora: "Circular Vale Transportes",
    statusProcessamento: "ENCAMINHADO",
    observacoes: "Materiais encaminhados para desmontagem e reciclagem.",
    ativo: true,
  },
  {
    id: "a2c00001-0000-4000-8000-000000000005",
    organizacaoId: DEMO_ORGANIZATIONS[2]!.id,
    dataEntrada: dateRelativeToToday(-42),
    notaFiscal: "DEMO-AV2-NF-0005",
    transportadora: "Rota Reversa Ambiental",
    statusProcessamento: "FINALIZADO",
    observacoes: "Processamento concluído; registro mantido para consulta histórica.",
    ativo: true,
  },
  {
    id: "a2c00001-0000-4000-8000-000000000006",
    organizacaoId: DEMO_ORGANIZATIONS[3]!.id,
    dataEntrada: dateRelativeToToday(-55),
    notaFiscal: "DEMO-AV2-NF-0006",
    transportadora: "Rota Reversa Ambiental",
    statusProcessamento: "FINALIZADO",
    observacoes: "Lote histórico finalizado antes da desativação da organização.",
    ativo: false,
  },
];

const DEMO_EQUIPMENT: DemoEquipment[] = [
  {
    id: "a2d00001-0000-4000-8000-000000000001",
    codigoBarrasInterno: "DEMO-AV2-EQ-0001",
    tipo: "CABO_ESTRUTURADO",
    marca: "GreenLink",
    modelo: "Cat6-10m",
    anoFabricacao: 2025,
    estadoFisico: "NOVO",
    pesoQuilogramas: "0.150",
    loteId: null,
    posicaoNoLote: null,
    statusRastreamento: "AGUARDANDO_TRIAGEM",
    ativo: true,
    valorAquisicao: "25.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000002",
    codigoBarrasInterno: "DEMO-AV2-EQ-0002",
    tipo: "COMPUTADOR_MESA",
    marca: "TechVale",
    modelo: "Office SFF 400",
    anoFabricacao: 2022,
    estadoFisico: "BOM_ESTADO",
    pesoQuilogramas: "7.800",
    loteId: DEMO_LOTS[0]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "AGUARDANDO_TRIAGEM",
    ativo: true,
    valorAquisicao: "2800.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000003",
    codigoBarrasInterno: "DEMO-AV2-EQ-0003",
    tipo: "MONITOR",
    marca: "VistaTech",
    modelo: "LED 24 FHD",
    anoFabricacao: 2021,
    estadoFisico: "USADO_LEVE",
    pesoQuilogramas: "3.200",
    loteId: DEMO_LOTS[0]!.id,
    posicaoNoLote: 1,
    statusRastreamento: "AGUARDANDO_TRIAGEM",
    ativo: true,
    valorAquisicao: "980.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000004",
    codigoBarrasInterno: "DEMO-AV2-EQ-0004",
    tipo: "NOTEBOOK",
    marca: "ByteNorte",
    modelo: "Pro 14",
    anoFabricacao: 2020,
    estadoFisico: "USADO_MODERADO",
    pesoQuilogramas: "1.650",
    loteId: DEMO_LOTS[1]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "EM_TRIAGEM",
    ativo: true,
    valorAquisicao: "3500.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000005",
    codigoBarrasInterno: "DEMO-AV2-EQ-0005",
    tipo: "IMPRESSORA",
    marca: "PapelZero",
    modelo: "Laser 220",
    anoFabricacao: 2019,
    estadoFisico: "DANIFICADO_LEVE",
    pesoQuilogramas: "5.400",
    loteId: DEMO_LOTS[1]!.id,
    posicaoNoLote: 1,
    statusRastreamento: "EM_TRIAGEM",
    ativo: true,
    valorAquisicao: "720.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000006",
    codigoBarrasInterno: "DEMO-AV2-EQ-0006",
    tipo: "SERVIDOR",
    marca: "DataVale",
    modelo: "Rack 1U R210",
    anoFabricacao: 2018,
    estadoFisico: "USADO_MODERADO",
    pesoQuilogramas: "12.400",
    loteId: DEMO_LOTS[2]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "AGUARDANDO_DESMONTE",
    ativo: true,
    valorAquisicao: "6200.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000007",
    codigoBarrasInterno: "DEMO-AV2-EQ-0007",
    tipo: "ROTEADOR",
    marca: "ConectaSul",
    modelo: "Dual WAN AC",
    anoFabricacao: 2017,
    estadoFisico: "DANIFICADO_GRAVE",
    pesoQuilogramas: "0.850",
    loteId: DEMO_LOTS[2]!.id,
    posicaoNoLote: 1,
    statusRastreamento: "AGUARDANDO_DESMONTE",
    ativo: true,
    valorAquisicao: "460.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000008",
    codigoBarrasInterno: "DEMO-AV2-EQ-0008",
    tipo: "FONTE_ALIMENTACAO",
    marca: "EnergiaSegura",
    modelo: "ATX 600W",
    anoFabricacao: 2016,
    estadoFisico: "DANIFICADO_GRAVE",
    pesoQuilogramas: "1.900",
    loteId: DEMO_LOTS[3]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "EM_DESMONTE",
    ativo: true,
    valorAquisicao: "310.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000009",
    codigoBarrasInterno: "DEMO-AV2-EQ-0009",
    tipo: "CABO_ESTRUTURADO",
    marca: "GreenLink",
    modelo: "Lote de cabos mistos",
    anoFabricacao: 2015,
    estadoFisico: "INSERVIVEL",
    pesoQuilogramas: "8.600",
    loteId: DEMO_LOTS[3]!.id,
    posicaoNoLote: 1,
    statusRastreamento: "MATERIAL_RECICLAVEL",
    ativo: true,
    valorAquisicao: "80.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000010",
    codigoBarrasInterno: "DEMO-AV2-EQ-0010",
    tipo: "IMPRESSORA",
    marca: "PapelZero",
    modelo: "Multifuncional M120",
    anoFabricacao: 2020,
    estadoFisico: "USADO_LEVE",
    pesoQuilogramas: "4.900",
    loteId: DEMO_LOTS[4]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "PECAS_REAPROVEITADAS",
    ativo: true,
    valorAquisicao: "540.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000011",
    codigoBarrasInterno: "DEMO-AV2-EQ-0011",
    tipo: "COMPUTADOR_MESA",
    marca: "TechVale",
    modelo: "Desktop legado",
    anoFabricacao: 2012,
    estadoFisico: "INSERVIVEL",
    pesoQuilogramas: "8.100",
    loteId: DEMO_LOTS[4]!.id,
    posicaoNoLote: 1,
    statusRastreamento: "BAIXA_DEFINITIVA",
    ativo: false,
    valorAquisicao: "1600.00",
  },
  {
    id: "a2d00001-0000-4000-8000-000000000012",
    codigoBarrasInterno: "DEMO-AV2-EQ-0012",
    tipo: "MONITOR",
    marca: "VistaTech",
    modelo: "LCD 17 legado",
    anoFabricacao: 2010,
    estadoFisico: "INSERVIVEL",
    pesoQuilogramas: "4.300",
    loteId: DEMO_LOTS[5]!.id,
    posicaoNoLote: 0,
    statusRastreamento: "DESCARTE_SEGURO",
    ativo: true,
    valorAquisicao: "250.00",
  },
];

async function ensureDemoData(tx: SeedTransaction): Promise<void> {
  for (const data of DEMO_ORGANIZATIONS) {
    const row = await tx.organizacao.upsert({ where: { id: data.id }, update: {}, create: data });
    if (row.cnpj !== data.cnpj) throw new Error("Colisão com identificador reservado de organização demonstrativa.");
  }

  for (const data of DEMO_CONTRACTS) {
    const row = await tx.contrato.upsert({ where: { id: data.id }, update: {}, create: data });
    if (row.organizacaoId !== data.organizacaoId) throw new Error("Colisão com identificador reservado de contrato demonstrativo.");
  }

  for (const data of DEMO_LOTS) {
    const row = await tx.lote.upsert({ where: { id: data.id }, update: {}, create: data });
    if (row.organizacaoId !== data.organizacaoId || row.notaFiscal !== data.notaFiscal) {
      throw new Error("Colisão com identificador reservado de lote demonstrativo.");
    }
  }

  for (const data of DEMO_EQUIPMENT) {
    const row = await tx.equipamento.upsert({ where: { id: data.id }, update: {}, create: data });
    if (row.codigoBarrasInterno !== data.codigoBarrasInterno) {
      throw new Error("Colisão com identificador reservado de equipamento demonstrativo.");
    }
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL precisa estar definida para executar o seed.");
  }

  // Validate bootstrap configuration before any writes.
  const bootstrapAdmin = getBootstrapAdminConfig();
  const senhaHash = bootstrapAdmin ? await bcrypt.hash(bootstrapAdmin.senha, 12) : undefined;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.parametroGlobal.upsert({
        where: { id: "global" },
        update: {},
        create: {
          id: "global",
          aliquotaImpostoPercentual: "0.00",
          taxaDepreciacaoAnualPercentual: "15.00",
        },
      });

      if (bootstrapAdmin && senhaHash) {
        await tx.usuario.upsert({
          where: { usuario: bootstrapAdmin.usuario },
          // Deliberately empty: rerunning seed never changes an existing password.
          update: {},
          create: {
            usuario: bootstrapAdmin.usuario,
            nome: bootstrapAdmin.nome,
            senhaHash,
            papel: "ADMINISTRADOR",
            ativo: true,
          },
        });
      }

      await ensureDemoData(tx);
    });

    if (bootstrapAdmin) {
      console.info("Bootstrap do Administrador concluído; credenciais existentes foram preservadas.");
    } else {
      console.info(
        "Nenhum Administrador foi criado; configure as três variáveis BOOTSTRAP_ADMIN_* explicitamente para provisioná-lo.",
      );
    }
    console.info("Dados demonstrativos de organizações, contratos, lotes e equipamentos verificados.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const safeConfigurationError = /^(DATABASE_URL precisa estar definida|Configuração incompleta: informe BOOTSTRAP_ADMIN_USERNAME|BOOTSTRAP_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres|Colisão com identificador reservado de (organização|contrato|lote|equipamento) demonstrativo\.)/.test(message);
  if (safeConfigurationError) {
    console.error("Falha ao executar seed:", message);
  } else {
    // Driver/ORM errors can contain query arguments or connection details; do not print them.
    console.error("Falha ao executar seed. Revise a configuração do banco e a conectividade; detalhes foram omitidos para proteger credenciais e dados.");
  }
  process.exitCode = 1;
});
