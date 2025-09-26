import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { subDays } from 'date-fns';
import { PdfType } from '@prisma/client';

@Injectable()
export class PdfsScheduler {
  private readonly logger = new Logger(PdfsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Roda todo dia às 3 da manhã para excluir relatórios judiciais com mais de 7 dias.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'cleanupOldJudicialReports' })
  async handleCleanupOldReports() {
    this.logger.log(
      'Iniciando a verificação de relatórios judiciais expirados...',
    );

    const sevenDaysAgo = subDays(new Date(), 7);

    const expiredReports = await this.prisma.generatedPdf.findMany({
      where: {
        pdfType: PdfType.RELATORIO_JUDICIAL,
        generatedAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    if (expiredReports.length === 0) {
      this.logger.log('Nenhum relatório judicial expirado encontrado.');
      return;
    }

    this.logger.log(
      `Encontrados ${expiredReports.length} relatórios para excluir.`,
    );

    const filePathsToDelete = expiredReports.map((report) => report.filePath);
    const reportIdsToDelete = expiredReports.map((report) => report.id);

    try {
      //  Deleta os arquivos do storage
      if (filePathsToDelete.length > 0) {
        await this.storageService.deleteFiles(filePathsToDelete);
        this.logger.log(
          `${filePathsToDelete.length} arquivos de relatório foram removidos do storage.`,
        );
      }

      //  Deleta os registros do banco de dados
      await this.prisma.generatedPdf.deleteMany({
        where: {
          id: {
            in: reportIdsToDelete,
          },
        },
      });
      this.logger.log(
        `${reportIdsToDelete.length} registros de relatório foram removidos do banco de dados.`,
      );
    } catch (error) {
      this.logger.error(
        'Falha ao limpar relatórios judiciais expirados.',
        error,
      );
    }
  }
}
