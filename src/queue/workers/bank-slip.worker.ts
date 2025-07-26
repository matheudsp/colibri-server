import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import type { BankSlipsService } from 'src/modules/bank-slips/bank-slips.service';

@Injectable()
@Processor('bank-slip')
export class BankSlipWorker {
  private readonly logger = new Logger(BankSlipWorker.name);
  constructor(private readonly bankSlipsService: BankSlipsService) {}

  @Process('generate-boleto')
  async handleGenerateBoleto(job: Job<{ paymentOrderId: string }>) {
    const { paymentOrderId } = job.data;

    try {
      await this.bankSlipsService.generateForPaymentOrder(paymentOrderId);
      this.logger.log(
        `Boleto gerado com sucesso para a ordem de pagamento ${paymentOrderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao processar gerar boleto para a ordem ${paymentOrderId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      throw error;
    }
  }
}
