import * as argon2 from 'argon2';
import { PrismaClient, UserRole, type Prisma } from '@prisma/client';
import 'dotenv/config';
import { addMonths } from 'date-fns';

const prisma = new PrismaClient();

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
  await prisma.asaasCustomer.deleteMany();
  await prisma.subAccount.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.document.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.paymentOrder.deleteMany();
  await prisma.paymentSplit.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.bankSlip.deleteMany();
  await prisma.property.deleteMany();
  await prisma.condominium.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️ Dados limpos com sucesso.');

  const adminPassword = await argon2.hash(
    process.env.SEED_ADMIN_PASSWORD || 'admin_123',
  );
  const landlordPassword = await argon2.hash(
    process.env.SEED_LANDLORD_PASSWORD || 'usuario_123',
  );
  const tenantPassword = await argon2.hash(
    process.env.SEED_TENANT_PASSWORD || 'usuario_123',
  );

  console.log('👤 Criando usuários...');
  const admin = await prisma.user.create({
    data: {
      name: process.env.SEED_ADMIN_NAME || 'Administrador da Plataforma',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@imobilia.io',
      password: adminPassword,
      cpfCnpj: generateRandomCpf(),
      role: UserRole.ADMIN,
    },
  });

  const locador = await prisma.user.create({
    data: {
      name: process.env.SEED_LANDLORD_NAME || 'Ricardo Proprietário',
      email: process.env.SEED_LANDLORD_EMAIL || 'ricardo.prop@imobilia.io',
      password: landlordPassword,
      cpfCnpj: generateRandomCpf(),
      phone: '11987654321',
      role: UserRole.LOCADOR,
    },
  });

  const locatario = await prisma.user.create({
    data: {
      name: process.env.SEED_TENANT_NAME || 'Mariana Inquilina',
      email: process.env.SEED_TENANT_EMAIL || 'mariana.inquilina@imobilia.io',
      password: tenantPassword,
      cpfCnpj: generateRandomCpf(),
      phone: '21912345678',
      role: UserRole.LOCATARIO,
    },
  });
  console.log('👤 Usuários criados:', { admin, locador, locatario });

  console.log('🏢 Criando um Condomínio...');
  const condominioResidencial = await prisma.condominium.create({
    data: {
      name: 'Residencial das Flores',
      cep: '04538-133',
      street: 'Avenida Brigadeiro Faria Lima',
      number: '4509',
      district: 'Itaim Bibi',
      city: 'São Paulo',
      state: 'SP',
      landlordId: locador.id,
    },
  });
  console.log('🏢 Condomínio criado:', condominioResidencial);

  console.log('🏠 Criando unidades (Properties) dentro do Condomínio...');
  await prisma.property.create({
    data: {
      title: 'Apartamento 2 Quartos com Varanda',
      description: 'Unidade 101, Bloco A. Sol da manhã.',
      number: '101',
      complement: 'Bloco A',
      areaInM2: 65,
      numRooms: 2,
      numBathrooms: 1,
      numParking: 1,
      landlordId: locador.id,
      condominiumId: condominioResidencial.id,
      photos: {
        create: [{ filePath: '/uploads/apartamento_101.jpg' }],
      },
    },
  });

  const apartamento202 = await prisma.property.create({
    data: {
      title: 'Apartamento 3 Quartos (Cobertura)',
      description: 'Unidade 202, Bloco B. Cobertura com área gourmet.',
      number: '202',
      complement: 'Bloco B',
      areaInM2: 120,
      numRooms: 3,
      numBathrooms: 2,
      numParking: 2,
      isAvailable: false,
      landlordId: locador.id,
      condominiumId: condominioResidencial.id,
    },
  });
  console.log('🏠 Unidades do condomínio criadas.');

  console.log('🏡 Criando uma propriedade avulsa (Casa)...');
  const casaDeRua = await prisma.property.create({
    data: {
      title: 'Casa Espaçosa com Quintal',
      description: 'Ótima casa em rua tranquila, ideal para famílias.',
      cep: '05407-002',
      street: 'Rua dos Pinheiros',
      number: '1500',
      district: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      areaInM2: 150,
      numRooms: 3,
      numBathrooms: 2,
      numParking: 2,
      landlordId: locador.id,
      condominiumId: null,
    },
  });
  console.log('🏡 Casa avulsa criada:', casaDeRua);

  console.log('✍️ Criando contrato de aluguel para o Apto 202...');
  const hoje = new Date();
  const contract = await prisma.contract.create({
    data: {
      propertyId: apartamento202.id,
      landlordId: locador.id,
      tenantId: locatario.id,
      status: 'ATIVO',
      rentAmount: 4500.0,
      condoFee: 800.0,
      iptuFee: 300.0,
      durationInMonths: 24,
      guaranteeType: 'SEGURO_FIANCA',
      startDate: hoje,
      endDate: new Date(new Date().setMonth(hoje.getMonth() + 24)),
    },
  });
  console.log('✍️ Contrato criado:', contract);
  console.log(
    '🧾 Gerando ordens de pagamento (mensalidades) para o contrato...',
  );

  const paymentsToCreate: Prisma.PaymentOrderCreateManyInput[] = [];
  const totalAmount =
    contract.rentAmount.toNumber() +
    (contract.condoFee?.toNumber() || 0) +
    (contract.iptuFee?.toNumber() || 0);

  for (let i = 0; i < contract.durationInMonths; i++) {
    const dueDate = addMonths(contract.startDate, i + 1);
    paymentsToCreate.push({
      contractId: contract.id,
      dueDate: dueDate,
      amountDue: totalAmount,
      status: 'PENDENTE',
    });
  }

  if (paymentsToCreate.length > 0) {
    await prisma.paymentOrder.createMany({
      data: paymentsToCreate,
    });
    console.log(
      `🧾 ${paymentsToCreate.length} ordens de pagamento criadas com sucesso.`,
    );
  }
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
