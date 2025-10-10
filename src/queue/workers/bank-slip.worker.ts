import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, ConflictException } from '@nestjs/common'; // 1. Importe ConflictException
import { Job } from 'bull';
import { ChargesService } from 'src/modules/charges/charges.service';
import { GenerateMonthlyChargeJob, ChargeJobType } from '../jobs/charge.job';
import { QueueName } from '../jobs/jobs';

@Injectable()
@Processor(QueueName.CHARGE)
export class BankSlipWorker {
  private logger = new Logger(BankSlipWorker.name);

  constructor(private chargesService: ChargesService) {}

  @Process(ChargeJobType.GENERATE_MONTHLY_CHARGE)
  async handleGenerateBankSlip(job: Job<GenerateMonthlyChargeJob>) {
    const { paymentOrderId } = job.data;

    try {
      await this.chargesService.generateChargeForPaymentOrder(
        paymentOrderId,
        'BOLETO',
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
