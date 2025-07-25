import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BoletosService } from 'src/modules/boletos/boletos.service';

@Injectable()
@Processor('boleto')
export class BoletoWorker {
  private readonly logger = new Logger(BoletoWorker.name);
  constructor(private readonly boletoService: BoletosService) {}

  @Process('generate-boleto')
  async handleGenerateBoleto(job: Job<{ paymentOrderId: string }>) {
    const { paymentOrderId } = job.data;

    try {
      await this.boletoService.generateForPaymentOrder(paymentOrderId);
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
