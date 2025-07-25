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
import { SubaccountService } from '../subaccount/subaccount.service';

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private prisma: PrismaService,
    private subaccountService: SubaccountService,
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
    if (
      await this.prisma.bankAccount.findUnique({
        where: { userId: currentUser.sub },
      })
    ) {
      throw new ConflictException(
        'Este usuário já possui uma conta bancária cadastrada.',
      );
    }

    const walletId = await this.subaccountService.getOrCreateSubaccount(user);

    try {
      const bankAccount = await this.prisma.bankAccount.create({
        data: {
          userId: currentUser.sub,
          ...createBankAccountDto,
          asaasWalletId: walletId,
        },
      });

      this.logger.log(
        `Conta bancária local criada para o usuário ${currentUser.sub}.`,
      );
      return bankAccount;
    } catch (dbError) {
      this.logger.error(
        'Falha ao salvar a conta bancária no banco de dados',
        dbError,
      );
      throw new InternalServerErrorException(
        'Erro ao salvar os dados da conta bancária.',
      );
    }
  }

}
