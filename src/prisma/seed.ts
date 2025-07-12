import * as argon2 from 'argon2';
import { PrismaClient, Prisma, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Função auxiliar para gerar CPFs únicos e fakes
const generateRandomCpf = () => {
  const rnd = () => Math.floor(Math.random() * 9);
  const n = Array(9).fill(0).map(rnd);
  let d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0) % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  let d2 = (d1 * 2 + n.reduce((acc, val, i) => acc + val * (11 - i), 0)) % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  return `${n.join('')}${d1}${d2}`;
};

async function main() {
  console.log('🌱 Iniciando o processo de seed...');

  console.log('🗑️ Limpando dados existentes...');
  await prisma.foto.deleteMany();
  await prisma.itemVistoria.deleteMany();
  await prisma.ambiente.deleteMany();
  await prisma.vistoria.deleteMany();
  await prisma.pagamento.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.contrato.deleteMany();
  await prisma.imovel.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️ Dados limpos com sucesso.');

  const adminPassword = await argon2.hash('admin_123');
  const userPassword = await argon2.hash('usuario_123');

  console.log('👤 Criando usuários...');
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador da Plataforma',
      email: 'admin@imobilia.io',
      password: adminPassword,
      cpf: generateRandomCpf(),
      role: 'ADMIN',
    },
  });

  const locador = await prisma.user.create({
    data: {
      name: 'Ricardo Proprietário',
      email: 'ricardo.prop@imobilia.io',
      password: userPassword,
      cpf: generateRandomCpf(),
      phone: '11987654321',
      role: 'LOCADOR',
    },
  });

  const locatario = await prisma.user.create({
    data: {
      name: 'Mariana Inquilina',
      email: 'mariana.inquilina@imobilia.io',
      password: userPassword,
      cpf: generateRandomCpf(),
      phone: '21912345678',
      role: 'LOCATARIO',
    },
  });

  const vistoriador = await prisma.user.create({
    data: {
      name: 'Carlos Vistoriador',
      email: 'carlos.vistoriador@imobilia.io',
      password: userPassword,
      cpf: generateRandomCpf(),
      role: 'VISTORIADOR',
    },
  });
  console.log('👤 Usuários criados:', {
    admin,
    locador,
    locatario,
    vistoriador,
  });

  console.log('🏠 Criando imóvel...');
  const imovel = await prisma.imovel.create({
    data: {
      title: 'Apartamento moderno no centro da cidade',
      description:
        'Lindo apartamento com 2 quartos, sendo 1 suíte. Cozinha planejada e varanda gourmet. Perto de tudo!',
      cep: '01001-000',
      street: 'Praça da Sé',
      number: '123',
      complement: 'Apto 42',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      areaInM2: 75.5,
      numRooms: 2,
      numBathrooms: 2,
      numParking: 1,
      isAvailable: false, // O imóvel será alugado no contrato abaixo
      landlordId: locador.id,
    },
  });
  console.log('🏠 Imóvel criado:', imovel);

  console.log('✍️ Criando contrato de aluguel...');
  const hoje = new Date();
  const contrato = await prisma.contrato.create({
    data: {
      imovelId: imovel.id,
      landlordId: locador.id,
      tenantId: locatario.id,
      status: 'ATIVO',
      rentAmount: 2500.0,
      condoFee: 500.0,
      iptuFee: 150.0,
      durationInMonths: 30,
      guaranteeType: 'DEPOSITO_CAUCAO',
      securityDeposit: 5000.0, // 2x o valor do aluguel
      startDate: hoje,
      endDate: new Date(new Date().setMonth(hoje.getMonth() + 30)),
    },
  });
  console.log('✍️ Contrato criado:', contrato);

  console.log('💵 Gerando pagamentos...');
  const pagamentos: Prisma.PagamentoCreateManyInput[] = [];

  for (let i = 0; i < 12; i++) {
    const vencimento = new Date(hoje);
    vencimento.setMonth(vencimento.getMonth() + i);
    vencimento.setDate(5); // Vencimento todo dia 5

    pagamentos.push({
      contractId: contrato.id,
      amountDue:
        contrato.rentAmount +
        (contrato.condoFee ?? 0) +
        (contrato.iptuFee ?? 0),
      dueDate: vencimento,
      status: i < 2 ? PaymentStatus.PAGO : PaymentStatus.PENDENTE,
      paidAt: i < 2 ? vencimento : undefined,
    });
  }
  await prisma.pagamento.createMany({ data: pagamentos });
  console.log(`💵 12 pagamentos gerados para o contrato ${contrato.id}.`);

  console.log('🕵️ Criando vistoria de entrada completa...');
  const vistoria = await prisma.vistoria.create({
    data: {
      imovelId: imovel.id,
      contractId: contrato.id,
      inspectorId: vistoriador.id,
      type: 'ENTRADA',
      inspectionDate: new Date(),
      observations:
        'Vistoria geral de entrada realizada com sucesso. Imóvel em bom estado.',

      ambientes: {
        create: [
          {
            name: 'Cozinha',
            description:
              'Cozinha com armários planejados e bancada de granito.',
            itens: {
              create: [
                {
                  name: 'Pia de Inox',
                  state: 'Em perfeito estado, sem riscos ou amassados.',
                  photos: {
                    create: [
                      { filePath: '/uploads/vistoria/cozinha_pia_01.jpg' },
                    ],
                  },
                },
                {
                  name: 'Piso de Porcelanato',
                  state:
                    'Bom estado, com leve desgaste natural perto da geladeira.',
                },
              ],
            },
          },
          {
            name: 'Sala de Estar',
            description: 'Sala ampla para dois ambientes com acesso à varanda.',
            itens: {
              create: [
                {
                  name: 'Parede (Pintura)',
                  state:
                    'Pintura nova, cor branco gelo, sem marcas ou manchas.',
                },
                {
                  name: 'Janela da Varanda',
                  state:
                    'Vidro e esquadrias em perfeito estado. Fechando normalmente.',
                  photos: {
                    create: [
                      { filePath: '/uploads/vistoria/sala_janela_01.jpg' },
                      { filePath: '/uploads/vistoria/sala_janela_02.jpg' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('🕵️ Vistoria de entrada criada:', vistoria);

  console.log('✅ Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o processo de seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
