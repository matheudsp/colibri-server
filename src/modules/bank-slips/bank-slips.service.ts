import { ConfigService } from '@nestjs/config';
import { AsaasCustomerService } from '../asaas-customer/asaas-customer.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateUtils } from 'src/common/utils/date.utils';

@Injectable()
export class BankSlipsService {
  private readonly platformWalletId: string;

  constructor(
    private prisma: PrismaService,
    private paymentGateway: PaymentGatewayService,
    private asaasCustomerService: AsaasCustomerService,
    private configService: ConfigService,
  ) {
    this.platformWalletId = this.configService.getOrThrow('ASSAS_WALLET_ID');
  }

  async generateForPaymentOrder(paymentOrderId: string) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        bankSlip: true,
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
    if (paymentOrder.bankSlip)
      throw new ConflictException('Já existe um boleto para essa fatura.');
    if (paymentOrder.contract.status !== 'ATIVO')
      throw new BadRequestException('Contrato inativo.');

    const { contract } = paymentOrder;
    const landlord = contract.landlord;

    if (!landlord.subAccount?.apiKey || !landlord.bankAccount?.asaasWalletId)
      throw new BadRequestException('Conta do locador incompleta.');

    const customerId = await this.asaasCustomerService.getOrCreate(
      contract.tenant.id,
      landlord.subAccount.id,
    );

    const value =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    const dueDate = paymentOrder.dueDate.toISOString().split('T')[0];

    const charge = await this.paymentGateway.createChargeWithSplitOnSubAccount(
      landlord.subAccount.apiKey,
      {
        customer: customerId,
        billingType: 'BOLETO',
        dueDate,
        value,
        description: `Aluguel ${contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
        split: [
          { walletId: landlord.bankAccount.asaasWalletId, percentualValue: 97 },
          { walletId: this.platformWalletId, percentualValue: 3 },
        ],
      },
    );

    return this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        bankSlip: {
          create: {
            asaasChargeId: charge.id,
            bankSlipUrl: charge.bankSlipUrl,
            invoiceUrl: charge.invoiceUrl,
            nossoNumero: charge.nossoNumero,
          },
        },
      },
      include: { bankSlip: true },
    });
  }

  // async generateMonthlyBoleto({ contractId, dueDate }: GenerateBoletoDto) {
  //   const targetDate = new Date(dueDate);
  //   if (isNaN(targetDate.getTime())) {
  //     throw new BadRequestException('Formato de data inválido.');
  //   }
  //   const startOfDueDate = startOfDay(targetDate);
  //   const endOfDueDate = endOfDay(targetDate);
  //   const contract = await this.prisma.contract.findUnique({
  //     where: { id: contractId },
  //     include: {
  //       tenant: true,
  //       landlord: { include: { subAccount: true, bankAccount: true } },
  //       paymentsOrders: true,
  //       property: true,
  //     },
  //   });

  //   if (!contract || contract.status !== 'ATIVO') {
  //     throw new BadRequestException('Contrato não encontrado ou inativo.');
  //   }

  //   const existing = await this.prisma.paymentOrder.findFirst({
  //     where: {
  //       contractId,
  //       dueDate: {
  //         gte: startOfDueDate, // Maior ou igual ao início do dia
  //         lte: endOfDueDate, // Menor ou igual ao final do dia
  //       },
  //     },
  //     // include: {
  //     //   contract: {
  //     //     include: {
  //     //       tenant: true,
  //     //       property: true,
  //     //     },
  //     //   },
  //     // },
  //   });

  //   if (existing) return existing;

  //   const landlordSubaccount = contract.landlord.subAccount;
  //   const landlordBankAccount = contract.landlord.bankAccount;

  //   if (!landlordSubaccount?.apiKey || !landlordBankAccount?.asaasWalletId) {
  //     throw new BadRequestException(
  //       'O locador não possui a conta configurada para recebimento. Consulte o locador e tente novamente.',
  //     );
  //   }

  //   const customerId = await this.asaasCustomerService.getOrCreate(
  //     contract.tenant.id,
  //     landlordSubaccount.id,
  //   );
  //   const value =
  //     contract.rentAmount.toNumber() +
  //     (contract.condoFee?.toNumber() ?? 0) +
  //     (contract.iptuFee?.toNumber() ?? 0);

  //   const charge = await this.paymentGateway.createChargeWithSplitOnSubAccount(
  //     landlordSubaccount.apiKey as string,
  //     {
  //       customer: customerId,
  //       billingType: 'BOLETO',
  //       dueDate: dueDate,
  //       value,
  //       description: `Aluguel ${contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
  //       split: [
  //         { walletId: landlordBankAccount.asaasWalletId, percentualValue: 97 },
  //         { walletId: this.platformWalletId, percentualValue: 3 },
  //       ],
  //     },
  //   );

  //   const payment = await this.prisma.paymentOrder.create({
  //     data: {
  //       contractId,
  //       dueDate: new Date(dueDate),
  //       amountDue: value,
  //       status: 'PENDENTE',
  //       boleto: {
  //         create: {
  //           asaasChargeId: charge.id,
  //           bankSlipUrl: charge.bankSlipUrl,
  //           invoiceUrl: charge.invoiceUrl,
  //           nossoNumero: charge.nossoNumero,
  //         },
  //       },
  //     },
  //     include: { boleto: true },
  //   });

  //   return payment;
  // }
}
