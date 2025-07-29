import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentStatus, type Prisma } from '@prisma/client';

import { addMonths } from 'date-fns';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsOrdersService {
  private readonly logger = new Logger(PaymentsOrdersService.name);
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
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

  async createPaymentsForContract(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar ordens de pagamento.',
      );
    }

    const existingPayments = await this.prisma.paymentOrder.count({
      where: { contractId },
    });

    if (existingPayments > 0) {
      console.log(
        `Pagamentos para o contrato ${contractId} já existem. Nenhuma ação foi tomada.`,
      );
      return;
    }

    const paymentsToCreate: Prisma.PaymentOrderCreateManyInput[] = [];
    const totalAmount =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    for (let i = 0; i < contract.durationInMonths; i++) {
      const dueDate = addMonths(contract.startDate, i + 1);
      paymentsToCreate.push({
        contractId: contract.id,
        dueDate: dueDate,
        amountDue: totalAmount,
        status: 'PENDENTE',
        paidAt: null,
      });
    }

    if (paymentsToCreate.length > 0) {
      await this.prisma.paymentOrder.createMany({
        data: paymentsToCreate,
      });
    }
  }

  async confirmPaymentByChargeId(
    asaasChargeId: string,
    amountPaid: number,
    paidAt: Date,
  ) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { asaasChargeId },
    });

    if (!bankSlip) {
      return;
    }

    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: bankSlip.paymentOrderId },
    });

    if (!paymentOrder) {
      return;
    }

    if (paymentOrder.status === PaymentStatus.PAGO) {
      return;
    }

    await this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: PaymentStatus.PAGO,
        amountPaid,
        paidAt,
      },
    });

    // OPCIONAL:  enfileirar um job para notificar o locador e o locatário!
    // await this.notificationQueue.add(...)
  }

  private async updatePaymentStatusByChargeId(
    asaasChargeId: string,
    status: PaymentStatus,
  ) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { asaasChargeId },
      select: { paymentOrderId: true },
    });

    if (!bankSlip) {
      this.logger.warn(
        `[Webhook] Boleto com asaasChargeId ${asaasChargeId} não encontrado. Evento de status ignorado.`,
      );
      return;
    }

    const updatedPayment = await this.prisma.paymentOrder.update({
      where: { id: bankSlip.paymentOrderId },
      data: { status },
    });

    this.logger.log(
      `[Webhook] Status do pagamento ${updatedPayment.id} atualizado para ${status}.`,
    );
  }

  async handleOverduePayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.ATRASADO,
    );
  }

  async handleDeletedPayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.CANCELADO,
    );
  }

  async handleRestoredPayment(asaasChargeId: string) {
    await this.updatePaymentStatusByChargeId(
      asaasChargeId,
      PaymentStatus.PENDENTE,
    );
  }
}
