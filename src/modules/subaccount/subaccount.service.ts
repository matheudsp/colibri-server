import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { User, type SubAccount } from '@prisma/client';
import {
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
} from 'src/common/interfaces/payment-gateway.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubaccountService {
  private readonly logger = new Logger(SubaccountService.name);

  constructor(
    private prisma: PrismaService,
    private paymentGatewayService: PaymentGatewayService,
  ) {}

  async getOrCreateSubaccount(
    user: User & { subAccount: SubAccount | null },
  ): Promise<SubAccount> {
    if (
      user.subAccount &&
      user.subAccount.asaasAccountId &&
      user.subAccount.apiKey &&
      user.subAccount.asaasWalletId
    ) {
      this.logger.log(
        `Subconta completa [${user.subAccount.asaasAccountId}] já existe localmente para o usuário ${user.id}. Retornando dados existentes.`,
      );
      return user.subAccount;
    }

    this.logger.log(
      `Iniciando processo de criação/atualização de subconta para o usuário ${user.id}.`,
    );
    this.validateUserForSubAccountCreation(user);

    const subaccountDto: CreateAsaasSubAccountDto = {
      name: user.name.trim(),
      email: user.email.trim(),
      cpfCnpj: user.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: user.phone!.trim(),
      address: user.street!.trim(),
      addressNumber: user.number!.trim(),
      province: user.province!.trim(),
      postalCode: user.cep!.replace(/\D/g, '').substring(0, 8),
      incomeValue: user.incomeValue?.toNumber() || 5000,
      ...(user.companyType
        ? { companyType: user.companyType }
        : { birthDate: user.birthDate!.toISOString().split('T')[0] }),
    };
    // console.log(subaccountDto);
    const asaasAccount =
      await this.paymentGatewayService.createWhitelabelSubAccount(
        subaccountDto,
      );

    try {
      const savedSubAccount = await this.prisma.subAccount.upsert({
        where: { userId: user.id },

        update: {
          asaasAccountId: asaasAccount.id,
          apiKey: asaasAccount.apiKey,
          asaasWalletId: asaasAccount.walletId,
        },

        create: {
          userId: user.id,
          asaasAccountId: asaasAccount.id,
          apiKey: asaasAccount.apiKey,
          asaasWalletId: asaasAccount.walletId,
        },
      });

      this.logger.log(
        `Subconta [${asaasAccount.id}] salva/atualizada no banco de dados para o usuário ${user.id}.`,
      );

      return savedSubAccount;
    } catch (error) {
      this.logger.error(
        `Falha ao salvar/atualizar a subconta no banco de dados para o usuário ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'A subconta foi criada no gateway, mas falhou ao ser salva localmente.',
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
          `O campo do usuário '${field}' é obrigatório para a criação da subconta.`,
        );
      }
    }

    if (!user.companyType && !user.birthDate) {
      throw new BadRequestException(
        "É necessário fornecer o 'tipo de empresa' (companyType) para PJ ou a 'data de nascimento' (birthDate) para PF.",
      );
    }
  }
}
