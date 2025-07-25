import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentStatus, type Prisma } from '@prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { UserService } from '../users/users.service';
import { GenerateBoletoDto } from './dto/generate-boleto.dto';
import { startOfDay, endOfDay } from 'date-fns';
import { DateUtils } from 'src/common/utils/date.utils';
import { addMonths } from 'date-fns';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsOrdersService {
  private readonly platformWalletId: string;
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    private paymentGateway: PaymentGatewayService,
    private userService: UserService,
    private configService: ConfigService,
  ) {
    this.platformWalletId =
      this.configService.getOrThrow<string>('ASSAS_WALLET_ID');
  }

  async findPaymentsByContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.tenantId !== currentUser.sub &&
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os pagamentos deste contrato.',
      );
    }

    return this.prisma.paymentOrder.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createPaymentsForContract(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar ordens de pagamento.',
      );
    }

    const paymentsToCreate: Prisma.PaymentOrderCreateManyInput[] = [];
    const totalAmount =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    for (let i = 0; i < contract.durationInMonths; i++) {
      const dueDate = addMonths(contract.startDate, i);
      paymentsToCreate.push({
        contractId: contract.id,
        dueDate: dueDate,
        amountDue: totalAmount,
        status: 'PENDENTE',
      });
    }

    if (paymentsToCreate.length > 0) {
      await this.prisma.paymentOrder.createMany({
        data: paymentsToCreate,
      });
    }
  }

  async generateBoletoForPaymentOrder(paymentOrderId: string) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        boleto: true,
        contract: {
          include: {
            tenant: true,
            landlord: { include: { bankAccount: true, subAccount: true } },
            property: true,
          },
        },
      },
    });

    if (!paymentOrder)
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    if (paymentOrder.boleto)
      throw new ConflictException(
        'Boleto existente, confira as últimas faturas.',
      );
    if (paymentOrder.contract.status !== 'ATIVO') {
      throw new BadRequestException(
        'O contrato desta ordem de pagamento não está ativo.',
      );
    }

    const landlordWalletId =
      paymentOrder.contract.landlord.bankAccount?.asaasWalletId;
    const landlordSubaccountApiKey =
      paymentOrder.contract.landlord.subAccount?.apiKey;
    if (!landlordWalletId || !landlordSubaccountApiKey) {
      throw new BadRequestException(
        'O locador não possui a conta configurada para recebimento. Consulte o locador e tente novamente.',
      );
    }

    const customerId = await this.userService.getOrCreateGatewayCustomer(
      paymentOrder.contract.tenant.id,
    );
    const value =
      paymentOrder.contract.rentAmount.toNumber() +
      (paymentOrder.contract.condoFee?.toNumber() ?? 0) +
      (paymentOrder.contract.iptuFee?.toNumber() ?? 0);

    const dueDate = paymentOrder.dueDate.toISOString().split('T')[0];
    const charge = await this.paymentGateway.createChargeWithSplitOnSubAccount(
      landlordSubaccountApiKey,
      {
        customer: customerId,
        billingType: 'BOLETO',
        dueDate: dueDate,
        value,
        description: `Aluguel ${paymentOrder.contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
        split: [
          { walletId: landlordWalletId, percentualValue: 97 },
          { walletId: this.platformWalletId, percentualValue: 3 },
        ],
      },
    );

    return this.prisma.paymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        boleto: {
          create: {
            asaasChargeId: charge.id,
            bankSlipUrl: charge.bankSlipUrl,
            invoiceUrl: charge.invoiceUrl,
            nossoNumero: charge.nossoNumero,
          },
        },
      },
      include: { boleto: true },
    });
  }

  async generateMonthlyBoleto({ contractId, dueDate }: GenerateBoletoDto) {
    const targetDate = new Date(dueDate);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Formato de data inválido.');
    }
    const startOfDueDate = startOfDay(targetDate);
    const endOfDueDate = endOfDay(targetDate);
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: true,
        landlord: { include: { subAccount: true, bankAccount: true } },
        paymentsOrders: true,
        property: true,
      },
    });

    if (!contract || contract.status !== 'ATIVO') {
      throw new BadRequestException('Contrato não encontrado ou inativo.');
    }

    const existing = await this.prisma.paymentOrder.findFirst({
      where: {
        contractId,
        dueDate: {
          gte: startOfDueDate, // Maior ou igual ao início do dia
          lte: endOfDueDate, // Menor ou igual ao final do dia
        },
      },
      // include: {
      //   contract: {
      //     include: {
      //       tenant: true,
      //       property: true,
      //     },
      //   },
      // },
    });

    if (existing) return existing;

    const landlordWalletId = contract.landlord.bankAccount?.asaasWalletId;
    const landlordSubaccountApiKey = contract.landlord.subAccount?.apiKey;
    if (!landlordWalletId || !landlordSubaccountApiKey) {
      throw new BadRequestException(
        'O locador não possui a conta configurada para recebimento. Consulte o locador e tente novamente.',
      );
    }

    const customerId = await this.userService.getOrCreateGatewayCustomer(
      contract.tenantId,
    );
    const value =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    const charge = await this.paymentGateway.createChargeWithSplitOnSubAccount(
      landlordSubaccountApiKey as string,
      {
        customer: customerId,
        billingType: 'BOLETO',
        dueDate: dueDate,
        value,
        description: `Aluguel ${contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
        split: [
          { walletId: landlordWalletId, percentualValue: 97 },
          { walletId: this.platformWalletId, percentualValue: 3 },
        ],
      },
    );

    const payment = await this.prisma.paymentOrder.create({
      data: {
        contractId,
        dueDate: new Date(dueDate),
        amountDue: value,
        status: 'PENDENTE',
        boleto: {
          create: {
            asaasChargeId: charge.id,
            bankSlipUrl: charge.bankSlipUrl,
            invoiceUrl: charge.invoiceUrl,
            nossoNumero: charge.nossoNumero,
          },
        },
      },
      include: { boleto: true },
    });

    return payment;
  }
}
