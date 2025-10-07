import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { BankSlipsService } from '../bank-slips/bank-slips.service';

@Injectable()
export class ContractPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsOrdersService: PaymentsOrdersService,
    private readonly bankSlipsService: BankSlipsService,
  ) {}

  async createPaymentsAndFirstBankSlip(contractId: string): Promise<void> {
    await this.paymentsOrdersService.createPaymentsForContract(contractId);

    const firstPaymentOrder = await this.prisma.paymentOrder.findFirst({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });

    if (firstPaymentOrder) {
      try {
        await this.bankSlipsService.generateBankSlipForPaymentOrder(
          firstPaymentOrder.id,
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
