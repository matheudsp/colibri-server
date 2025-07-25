import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { User, type SubAccount } from '@prisma/client';
import { CreateAsaasSubAccountDto } from 'src/common/interfaces/payment-gateway.interface';
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
  ): Promise<string> {
    if (!user.subAccount?.asaasAccountId) {
      this.logger.log(`Usuário ${user.id} não possui subconta. Criando...`);
      this.validateUserForSubAccountCreation(user);

      const subaccountDto: CreateAsaasSubAccountDto = {
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

      const asaasAccount =
        await this.paymentGatewayService.createWhitelabelSubAccount(
          subaccountDto,
        );

      await this.prisma.subAccount.update({
        where: { id: user.id },
        data: { asaasAccountId: asaasAccount.id },
      });

      this.logger.log(
        `Subconta criada [${asaasAccount.id}] para usuário ${user.id}`,
      );

      return asaasAccount.walletId;
    }

    this.logger.log(
      `Usuário ${user.id} já possui subconta [${user.subAccount.asaasAccountId}].`,
    );

    const accountDetails =
      await this.paymentGatewayService.getSubAccountDetails(
        user.subAccount.asaasAccountId,
      );

    if (!accountDetails?.walletId) {
      throw new InternalServerErrorException(
        'Não foi possível obter o walletId da subconta existente.',
      );
    }

    return accountDetails.walletId;
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
          `Campo '${field}' é obrigatório para criação da subconta.`,
        );
      }
    }

    if (!user.companyType && !user.birthDate) {
      throw new BadRequestException(
        "Informe 'tipo de companhia' (PJ) ou 'data de nascimento' (PF).",
      );
    }
  }
}
