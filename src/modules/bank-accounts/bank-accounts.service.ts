import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { User } from '@prisma/client';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import type { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private prisma: PrismaService,
    private subaccountService: SubaccountsService,
    private paymentGateway: PaymentGatewayService,
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
        'Apenas locadores podem criar contas bancárias.',
      );
    }
    const existingBankAccount = await this.prisma.bankAccount.findUnique({
      where: { userId: currentUser.sub },
    });

    if (existingBankAccount) {
      throw new ConflictException(
        'Este usuário já possui uma conta bancária cadastrada.',
      );
    }

    await this.subaccountService.getOrCreateSubaccount(user);

    try {
      const bankAccount = await this.prisma.bankAccount.create({
        data: {
          userId: currentUser.sub,
          ...createBankAccountDto,
        },
      });

      this.logger.log(
        `Conta bancária local criada para o usuário ${currentUser.sub}.`,
      );
      return bankAccount;
    } catch (dbError: any) {
      this.logger.error(
        'Falha ao salvar a conta bancária no banco de dados',
        dbError.stack,
      );
      throw new InternalServerErrorException(
        'Erro ao salvar os dados da conta bancária.',
      );
    }
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
    const existingAccount = await this.prisma.bankAccount.findUnique({
      where: { userId: currentUser.sub },
    });

    if (!existingAccount) {
      throw new NotFoundException('Nenhuma conta bancária para atualizar.');
    }

    const updatedAccount = await this.prisma.bankAccount.update({
      where: { userId: currentUser.sub },
      data: updateBankAccountDto,
    });

    this.logger.log(
      `Conta bancária atualizada para o usuário ${currentUser.sub}.`,
    );
    return updatedAccount;
  }
}
