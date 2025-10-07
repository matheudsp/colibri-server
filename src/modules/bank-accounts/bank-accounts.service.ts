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
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';
import { VerificationService } from '../verification/verification.service';
import { LogHelperService } from '../logs/log-helper.service';
@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private prisma: PrismaService,
    private subaccountService: SubaccountsService,
    private paymentGateway: PaymentGatewayService,
    private verificationService: VerificationService,
    private logHelper: LogHelperService,
  ) {}

  async create(
    createBankAccountDto: CreateBankAccountDto,
    currentUser: JwtPayload,
  ) {
    const { actionToken } = createBankAccountDto;
    await this.verificationService.consumeActionToken(
      actionToken,
      VerificationContexts.CREATE_BANK_ACCOUNT,
      currentUser.sub,
    );
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

    await this.logHelper.createLog(
      currentUser.sub,
      'CREATE',
      'BankAccount',
      bankAccount.id,
    );
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
        'Nenhuma conta de pagamento encontrada para este usuário. Cadastre sua Chave PIX para iniciar criação da conta de pagamentos',
      );
    }

    return this.paymentGateway.getBalance(user.subAccount.apiKey);
  }

  async findMyAccount(currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      include: {
        bankAccount: true,
        subAccount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    let balance = null;
    // Se o usuário tiver uma subconta com apiKey, busca o saldo em tempo real.
    if (user.subAccount?.apiKey) {
      try {
        balance = await this.paymentGateway.getBalance(user.subAccount.apiKey);
      } catch (error) {
        this.logger.error(
          `Falha ao buscar saldo para o usuário ${currentUser.sub}`,
          error,
        );
        // Em caso de erro, o saldo permanece nulo, mas a requisição não falha.
      }
    }

    return {
      // balance,
      bankAccount: user.bankAccount,
      subAccount: user.subAccount
        ? {
            // Adicionamos os status para o frontend saber o que fazer
            statusGeneral: user.subAccount.statusGeneral,
            statusDocumentation: user.subAccount.statusDocumentation,
            onboardingUrl: user.subAccount.onboardingUrl,
          }
        : null,
    };
  }

  async update(
    updateBankAccountDto: UpdateBankAccountDto,
    currentUser: JwtPayload,
  ) {
    const { actionToken, ...bankAccountData } = updateBankAccountDto;

    await this.verificationService.consumeActionToken(
      actionToken,
      VerificationContexts.PIX_KEY_UPDATE,
      currentUser.sub,
    );

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
    await this.logHelper.createLog(
      currentUser.sub,
      'UPDATE',
      'BankAccount',
      updatedAccount.id,
    );
    this.logger.log(`Chave PIX atualizada para o usuário ${currentUser.sub}.`);
    return updatedAccount;
  }
}
