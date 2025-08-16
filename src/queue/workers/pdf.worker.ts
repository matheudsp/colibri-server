import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PdfJobType, GenerateContractPdfJob } from '../jobs/pdf.job';
import { QueueName } from '../jobs/jobs';
import { generatePdfFromTemplate } from 'src/modules/pdfs/utils/pdf-generator';
import { StorageService } from 'src/storage/storage.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
@Processor(QueueName.PDF)
export class PdfWorker {
  private readonly logger = new Logger(PdfWorker.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Process(PdfJobType.GENERATE_CONTRACT_PDF)
  async handleGenerateContractPdf(job: Job<GenerateContractPdfJob>) {
    const { pdfRecordId, templateData, fileName, contractId } = job.data;
    this.logger.log(
      `Processando a geração do PDF para o registo: ${pdfRecordId}`,
    );

    try {
      const generatedBuffer = await generatePdfFromTemplate(
        'CONTRATO_LOCACAO',
        templateData,
      );

      const pdfBuffer = Buffer.from(generatedBuffer);

      const { key } = await this.storageService.uploadFile(
        {
          buffer: pdfBuffer,
          originalname: fileName,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        },
        { folder: `contracts/${contractId}` },
      );

      await this.prisma.generatedPdf.update({
        where: { id: pdfRecordId },
        data: { filePath: key },
      });

      this.logger.log(
        `PDF ${pdfRecordId} gerado e guardado com sucesso em: ${key}`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao processar o job de PDF ${pdfRecordId}`,
        error,
      );
      await this.prisma.generatedPdf.update({
        where: { id: pdfRecordId },
        data: { filePath: `contracts/${contractId}/failed-${fileName}` },
      });
      throw error;
    }
  }
}
