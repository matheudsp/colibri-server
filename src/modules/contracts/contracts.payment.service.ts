import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { ChargesService } from '../charges/charges.service';

@Injectable()
export class ContractPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsOrdersService: PaymentsOrdersService,
    private readonly chargesService: ChargesService,
  ) {}

  async createPaymentsAndFirstBankSlip(contractId: string): Promise<void> {
    await this.paymentsOrdersService.createPaymentsForContract(contractId);

    const firstPaymentOrder = await this.prisma.paymentOrder.findFirst({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });

    if (firstPaymentOrder) {
      try {
        await this.chargesService.generateChargeForPaymentOrder(
          firstPaymentOrder.id,
          'BOLETO',
        );
      } catch (error) {
        console.error(
          `Falha ao gerar o primeiro boleto para o contrato ${contractId} após ativação. O scheduler tentará novamente.`,
          error,
        );
      }
    }
  }
}
