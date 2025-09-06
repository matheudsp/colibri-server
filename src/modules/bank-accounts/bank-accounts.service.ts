import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';
@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private prisma: PrismaService,
    private subaccountService: SubaccountsService,
    private paymentGateway: PaymentGatewayService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(
    createBankAccountDto: CreateBankAccountDto,
    currentUser: JwtPayload,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: {
        subAccount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (user.role !== ROLES.LOCADOR) {
      throw new ForbiddenException(
        'Apenas locadores podem cadastrar chaves PIX.',
      );
    }
    const existingBankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId: currentUser.sub },
    });

    if (existingBankAccount) {
      throw new ConflictException(
        'Este usuário já possui uma chave PIX cadastrada.',
      );
    }

    // Garante que a subconta no Asaas existe antes de salvar a chave PIX
    await this.subaccountService.getOrCreateSubaccount(user);

    const bankAccount = await this.prisma.bankAccount.create({
      data: {
        userId: currentUser.sub,
        pixAddressKey: createBankAccountDto.pixAddressKey,
        pixAddressKeyType: createBankAccountDto.pixAddressKeyType,
      },
    });

    this.logger.log(`Chave PIX cadastrada para o usuário ${currentUser.sub}.`);
    return bankAccount;
  }

  async getBalance(currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: {
        subAccount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (user.role !== ROLES.LOCADOR) {
      throw new ForbiddenException('Apenas locadores podem consultar o saldo.');
    }
    if (!user.subAccount?.apiKey) {
      throw new NotFoundException(
        'Nenhuma subconta do gateway de pagamento encontrada para este usuário.',
      );
    }

    return this.paymentGateway.getBalance(user.subAccount.apiKey);
  }

  async findMyAccount(currentUser: JwtPayload) {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId: currentUser.sub },
    });

    if (!bankAccount) {
      throw new NotFoundException(
        'Nenhuma conta bancária encontrada para este usuário.',
      );
    }

    return bankAccount;
  }

  async update(
    updateBankAccountDto: UpdateBankAccountDto,
    currentUser: JwtPayload,
  ) {
    const { actionToken, ...bankAccountData } = updateBankAccountDto;
    const context = VerificationContexts.PIX_KEY_UPDATE;

    const actionTokenKey = `action-token:${currentUser.sub}:${context}`;
    const storedToken = await this.redis.get(actionTokenKey);

    if (!storedToken || storedToken !== actionToken) {
      throw new ForbiddenException(
        'Ação não autorizada. A verificação é necessária ou o token expirou.',
      );
    }

    await this.redis.del(actionTokenKey);

    const existingAccount = await this.prisma.bankAccount.findUnique({
      where: { userId: currentUser.sub },
    });

    if (!existingAccount) {
      throw new NotFoundException('Nenhuma conta bancária para atualizar.');
    }

    const updatedAccount = await this.prisma.bankAccount.update({
      where: { userId: currentUser.sub },
      data: bankAccountData,
    });

    this.logger.log(`Chave PIX atualizada para o usuário ${currentUser.sub}.`);
    return updatedAccount;
  }
}
