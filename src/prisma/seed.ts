import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';

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

  const adminPassword = await argon2.hash(
    process.env.SEED_ADMIN_PASSWORD || 'admin_123',
  );

  console.log('👤 Verificando/Criando usuários iniciais...');

  await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL || 'admin@colibri.com' },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME || 'Administrador Mestre',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@colibri.com',
      password: adminPassword,
      cpfCnpj: generateRandomCpf(),
      role: UserRole.ADMIN,
      phone: '11999999999',
      cep: '01001000',
      street: 'Praça da Sé',
      number: '1',
      city: 'São Paulo',
      state: 'SP',
      province: 'Sé',
      birthDate: new Date('1980-01-01'),
      incomeValue: 10000.0,
    },
  });

  console.log('👤 Usuários verificados/criados com sucesso!');

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
