import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, ConflictException } from '@nestjs/common'; // 1. Importe ConflictException
import { Job } from 'bull';
import { BankSlipsService } from 'src/modules/bank-slips/bank-slips.service';
import {
  BankSlipJobType,
  GenerateMonthlyBankSlipsJob,
} from '../jobs/bank-slip';
import { QueueName } from '../jobs/jobs';

@Injectable()
@Processor(QueueName.BANK_SLIP)
export class BankSlipWorker {
  private logger = new Logger(BankSlipWorker.name);

  constructor(private bankSlipsService: BankSlipsService) {}

  @Process(BankSlipJobType.GENERATE_MONTHLY_BANK_SLIPS)
  async handleGenerateBankSlip(job: Job<GenerateMonthlyBankSlipsJob>) {
    const { paymentOrderId } = job.data;

    try {
      await this.bankSlipsService.generateBankSlipForPaymentOrder(
        paymentOrderId,
      );
      this.logger.log(
        `✅ Boleto gerado com sucesso para a ordem de pagamento ${paymentOrderId}`,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.warn(
          `🟡 Job para a ordem ${paymentOrderId} já foi executado. Boleto já existe.`,
        );

        return;
      }

      this.logger.error(
        `❌ Falha ao processar job para a ordem ${paymentOrderId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
