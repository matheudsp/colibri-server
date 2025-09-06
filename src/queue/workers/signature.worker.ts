import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PdfsService } from 'src/modules/pdfs/pdfs.service';
import {
  InitiateSignatureProcessJob,
  SignatureJobType,
} from '../jobs/signature.job';
import { QueueName } from '../jobs/jobs';

@Injectable()
@Processor(QueueName.SIGNATURE)
export class SignatureWorker {
  private readonly logger = new Logger(SignatureWorker.name);

  constructor(private readonly pdfsService: PdfsService) {}

  @Process(SignatureJobType.INITIATE_SIGNATURE_PROCESS)
  async handleInitiateSignature(job: Job<InitiateSignatureProcessJob>) {
    const { contractId, userId, userRole } = job.data;

    this.logger.log(
      `Iniciando job de assinatura para o contrato ${contractId}...`,
    );

    try {
      await this.pdfsService.initiateSignatureProcess(contractId, {
        sub: userId,
        role: userRole,
      });
      this.logger.log(
        `Job de assinatura para o contrato ${contractId} concluído com sucesso.`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao processar job de assinatura para o contrato ${contractId}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      throw error;
    }
  }
}
