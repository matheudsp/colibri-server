import { ConfigService } from '@nestjs/config';
import { AsaasCustomersService } from '../asaas-customers/asaas-customers.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateUtils } from 'src/common/utils/date.utils';
import { PaymentStatus, type Prisma } from '@prisma/client';
import { differenceInDays } from 'date-fns';

@Injectable()
export class ChargesService {
  private readonly platformWalletId: string;
  private readonly logger = new Logger(ChargesService.name);
  constructor(
    private prisma: PrismaService,
    private paymentGateway: PaymentGatewayService,
    private asaasCustomerService: AsaasCustomersService,
    private configService: ConfigService,
  ) {
    this.platformWalletId = this.configService.getOrThrow('ASSAS_WALLET_ID');
  }
  /**
   * Gera um boleto para uma ordem de pagamento PENDENTE.
   **/
  async generateChargeForPaymentOrder(
    paymentOrderId: string,
    billingType: 'BOLETO' | 'PIX',
  ) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        charge: true,
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
    if (paymentOrder.charge)
      throw new ConflictException('Já existe uma cobrança para essa fatura.');
    if (paymentOrder.status === PaymentStatus.ATRASADO) {
      throw new BadRequestException(
        'Esta fatura está vencida. Por favor, solicite a emissão de uma novo cobranças cobrança.',
      );
    }

    if (paymentOrder.contract.status !== 'ATIVO')
      throw new BadRequestException('Contrato inativo.');

    const { contract } = paymentOrder;
    const landlord = contract.landlord;

    if (!landlord.subAccount?.apiKey || !landlord.subAccount?.asaasWalletId)
      throw new BadRequestException(
        'A conta do locador não está configurada para recebimentos. Entre em contato com suporte.',
      );

    const customerId = await this.asaasCustomerService.getOrCreate(
      contract.tenant.id,
      landlord.subAccount.id,
    );

    const value =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    const dueDate = paymentOrder.dueDate.toISOString().split('T')[0];
    if (new Date(dueDate) < new Date(new Date().toISOString().split('T')[0])) {
      throw new BadRequestException(
        'Não é permitido gerar um boleto com data de vencimento no passado.',
      );
    }
    const platformFee =
      landlord.subAccount.platformFeePercentage?.toNumber() || 5; // Usa 5% como padrão

    const chargePayload = {
      customer: customerId,
      billingType,
      dueDate,
      value,
      description: `Aluguel ${contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
      split: [
        { walletId: this.platformWalletId, percentualValue: platformFee },
      ],
      daysAfterDueDateToRegistrationCancellation: 60,
      fine: { value: 2, type: 'PERCENTAGE' as const },
      interest: { value: 1 },
    };
    const chargeResponse =
      await this.paymentGateway.createChargeWithSplitOnSubAccount(
        landlord.subAccount.apiKey,
        chargePayload,
      );
    const chargeData: Prisma.ChargeCreateInput = {
      paymentOrder: { connect: { id: paymentOrder.id } },
      asaasChargeId: chargeResponse.id,
      invoiceUrl: chargeResponse.invoiceUrl,
      dueDate: paymentOrder.dueDate,

      ...(billingType === 'BOLETO'
        ? {
            bankSlipUrl: chargeResponse.bankSlipUrl,
            nossoNumero: chargeResponse.nossoNumero,
          }
        : {
            pixQrCode: chargeResponse.pixQrCode,
            pixPayload: chargeResponse.pixPayload,
          }),
    };
    return this.prisma.charge.create({
      data: chargeData,
    });
    // return this.prisma.paymentOrder.update({
    //   where: { id: paymentOrder.id },
    //   data: {
    //     charge: {
    //       create: {
    //         asaasChargeId: chargeResponse.id,
    //         bankSlipUrl: chargeResponse.bankSlipUrl,
    //         invoiceUrl: chargeResponse.invoiceUrl,
    //         nossoNumero: chargeResponse.nossoNumero,
    //         dueDate: paymentOrder.dueDate,
    //       },
    //     },
    //   },
    //   include: { charge: true },
    // });
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
