import * as argon2 from 'argon2';
import { PrismaClient, Prisma, PaymentStatus, UserRole } from '@prisma/client';

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

  await prisma.log.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.property.deleteMany();
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
      role: UserRole.ADMIN,
    },
  });

  const locador = await prisma.user.create({
    data: {
      name: 'Ricardo Proprietário',
      email: 'ricardo.prop@imobilia.io',
      password: userPassword,
      cpf: generateRandomCpf(),
      phone: '11987654321',
      role: UserRole.LOCADOR,
    },
  });

  const locatario = await prisma.user.create({
    data: {
      name: 'Mariana Inquilina',
      email: 'mariana.inquilina@imobilia.io',
      password: userPassword,
      cpf: generateRandomCpf(),
      phone: '21912345678',
      role: UserRole.LOCATARIO,
    },
  });
  console.log('👤 Usuários criados:', { admin, locador, locatario });

  console.log('🏠 Criando imóvel com fotos...');
  const property = await prisma.property.create({
    data: {
      title: 'Apartamento moderno no centro da cidade',
      description:
        'Lindo apartamento com 2 quartos, sendo 1 suíte. Cozinha planejada e varanda gourmet.',
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
      isAvailable: false,
      landlordId: locador.id,
      photos: {
        create: [
          {
            filePath: '/uploads/properties/apartamento_centro_01.jpg',
            description: 'Vista da sala de estar',
          },
          {
            filePath: '/uploads/properties/apartamento_centro_02.jpg',
            description: 'Cozinha com armários',
          },
        ],
      },
    },
  });
  console.log('🏠 Imóvel criado:', property);

  console.log('✍️ Criando contrato de aluguel...');
  const hoje = new Date();
  const contract = await prisma.contract.create({
    data: {
      propertyId: property.id,
      landlordId: locador.id,
      tenantId: locatario.id,
      status: 'ATIVO',
      rentAmount: 2500.0,
      condoFee: 500.0,
      iptuFee: 150.0,
      durationInMonths: 30,
      guaranteeType: 'DEPOSITO_CAUCAO',
      securityDeposit: 5000.0,
      startDate: hoje,
      endDate: new Date(new Date().setMonth(hoje.getMonth() + 30)),
    },
  });
  console.log('✍️ Contrato criado:', contract);

  console.log('💵 Gerando pagamentos...');
  const payments: Prisma.PaymentCreateManyInput[] = [];

  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(hoje);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(5);

    payments.push({
      contractId: contract.id,
      amountDue:
        contract.rentAmount +
        (contract.condoFee ?? 0) +
        (contract.iptuFee ?? 0),
      dueDate: dueDate,
      status: i < 2 ? PaymentStatus.PAGO : PaymentStatus.PENDENTE,
      paidAt: i < 2 ? dueDate : undefined,
    });
  }
  await prisma.payment.createMany({ data: payments });
  console.log(`💵 12 pagamentos gerados para o contrato ${contract.id}.`);

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
