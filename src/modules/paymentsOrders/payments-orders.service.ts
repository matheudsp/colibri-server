import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentStatus } from '@prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { UserService } from '../users/users.service';
import type { GeneratePaymentDto } from './dto/generate-payment.dto';
import { startOfDay, endOfDay } from 'date-fns';
import { DateUtils } from 'src/common/utils/date.utils';

@Injectable()
export class PaymentsOrdersService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    private paymentGateway: PaymentGatewayService,
    private userService: UserService,
  ) {}

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

  async generateMonthlyBoleto({ contractId, dueDate }: GeneratePaymentDto) {
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
        landlord: { include: { bankAccount: true } },
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
    // const platformWalletId = process.env.ASAAS_WALLET_ID_PLATAFORMA;

    if (!landlordWalletId) {
      throw new BadRequestException('O .');
    }
    const customerId = await this.userService.getOrCreateGatewayCustomer(
      contract.tenantId,
    );
    const value =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    const charge = await this.paymentGateway.createChargeWithSplitOnSubAccount({
      customer: customerId,
      billingType: 'BOLETO',
      dueDate: dueDate,
      value,
      description: `Aluguel ${contract.property.title} - venc. ${DateUtils.formatDate(dueDate)}`,
      split: [
        { walletId: landlordWalletId, percentualValue: 97 },
        // { walletId: platformWalletId, percentualValue: 3 },
      ],
    });

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
