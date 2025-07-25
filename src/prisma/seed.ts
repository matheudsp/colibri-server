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
  // A ordem de limpeza é importante para respeitar as chaves estrangeiras
  await prisma.log.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.property.deleteMany();
  await prisma.condominium.deleteMany();
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
      cpfCnpj: generateRandomCpf(),
      role: UserRole.ADMIN,
    },
  });

  const locador = await prisma.user.create({
    data: {
      name: 'Ricardo Proprietário',
      email: 'ricardo.prop@imobilia.io',
      password: userPassword,
      cpfCnpj: generateRandomCpf(),
      phone: '11987654321',
      role: UserRole.LOCADOR,
    },
  });

  const locatario = await prisma.user.create({
    data: {
      name: 'Mariana Inquilina',
      email: 'mariana.inquilina@imobilia.io',
      password: userPassword,
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
  const apartamento101 = await prisma.property.create({
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
      condominiumId: condominioResidencial.id, // Associando ao condomínio
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
      isAvailable: false, // Marcando como indisponível
      landlordId: locador.id,
      condominiumId: condominioResidencial.id, // Associando ao condomínio
    },
  });
  console.log('🏠 Unidades do condomínio criadas.');

  console.log('🏡 Criando uma propriedade avulsa (Casa)...');
  const casaDeRua = await prisma.property.create({
    data: {
      title: 'Casa Espaçosa com Quintal',
      description: 'Ótima casa em rua tranquila, ideal para famílias.',
      // Endereço completo, pois não tem condomínio
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
      condominiumId: null, // Não pertence a um condomínio
    },
  });
  console.log('🏡 Casa avulsa criada:', casaDeRua);

  console.log('✍️ Criando contrato de aluguel para o Apto 202...');
  const hoje = new Date();
  const contract = await prisma.contract.create({
    data: {
      propertyId: apartamento202.id, // Usando a cobertura que já está alugada
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

  console.log('💵 Gerando pagamentos...');
  const payments: Prisma.PaymentCreateManyInput[] = [];

  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(hoje);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(10); // Vencimento dia 10
    const amountDue =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    payments.push({
      contractId: contract.id,
      amountDue: amountDue,
      dueDate: dueDate,
      status: i < 3 ? PaymentStatus.PAGO : PaymentStatus.PENDENTE, // 3 primeiros pagos
      paidAt: i < 3 ? dueDate : undefined,
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
