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
import {
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
} from 'src/common/interfaces/payment-gateway.interface';

@Injectable()
export class BankAccountsService {
  private readonly logger = new Logger(BankAccountsService.name);

  constructor(
    private prisma: PrismaService,
    private paymentGatewayService: PaymentGatewayService,
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

    let walletId: string;

    if (!user.subAccount?.asaasAccountId) {
      this.logger.log(`Usuário ${user.id} não possui subconta. Criando...`);
      this.validateUserForSubAccountCreation(user);

      const asaasAccountData: CreateAsaasSubAccountDto = {
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpfCnpj!,
        mobilePhone: user.phone!,
        address: user.street!,
        addressNumber: user.number!,
        province: user.province!,
        postalCode: user.cep!,
        incomeValue: user.incomeValue?.toNumber() || 5000,
        ...(user.companyType
          ? { companyType: user.companyType }
          : { birthDate: user.birthDate!.toISOString().split('T')[0] }),
      };

      try {
        const asaasAccount: CreateAsaasSubAccountResponse =
          await this.paymentGatewayService.createWhitelabelSubAccount(
            asaasAccountData,
          );

        await this.prisma.subAccount.create({
          data: {
            user: {
              connect: { id: user.id },
            },
            asaasAccountId: asaasAccount.id,
            apiKey: asaasAccount.apiKey,
          },
        });
        walletId = asaasAccount.walletId;

        this.logger.log(
          `Subconta Asaas [${asaasAccount.id}] criada e associada ao usuário [${user.id}]`,
        );
      } catch (error) {
        this.logger.error(
          `Falha ao criar subconta Asaas para o usuário ${user.id}`,
          error,
        );
        throw new InternalServerErrorException(
          'Não foi possível criar a subconta de pagamentos. Verifique os dados da sua conta e tente novamente.',
        );
      }
    } else {
      this.logger.log(
        `Usuário ${user.id} já possui subconta [${user.subAccount.asaasAccountId}]. Buscando dados da carteira...`,
      );
      try {
        const accountDetails: CreateAsaasSubAccountResponse =
          await this.paymentGatewayService.getSubAccountDetails(
            user.subAccount.asaasAccountId,
          );

        if (!accountDetails || !accountDetails.walletId) {
          throw new InternalServerErrorException(
            'Não foi possível obter os detalhes da carteira da subconta existente.',
          );
        }

        walletId = accountDetails.walletId;
      } catch (error) {
        this.logger.error(
          `Falha ao buscar detalhes da subconta Asaas ${user.subAccount.asaasAccountId}`,
          error,
        );
        throw new InternalServerErrorException(
          'Falha ao verificar os dados da sua conta de pagamentos existente.',
        );
      }
    }

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

  private validateUserForSubAccountCreation(user: User): void {
    const requiredFields: (keyof User)[] = [
      'name',
      'email',
      'cpfCnpj',
      'phone',
      'street',
      'number',
      'province',
      'cep',
    ];

    for (const field of requiredFields) {
      if (!user[field]) {
        throw new BadRequestException(
          `O campo '${field}' do perfil do usuário é obrigatório para criar a subconta de pagamentos.`,
        );
      }
    }

    if (!user.companyType && !user.birthDate) {
      throw new BadRequestException(
        "É necessário fornecer 'companyType' para PJ ou 'birthDate' para PF no perfil do usuário.",
      );
    }
  }
}
