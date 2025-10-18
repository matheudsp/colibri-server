import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { PdfType } from '@prisma/client';
import {
  generatePdfFromHtml,
  generatePdfFromTemplate,
} from './utils/pdf-generator';
import type { JudicialReportTemplateData } from './types/judicial-report-template.interface';
import Handlebars from 'handlebars';

@Injectable()
export class PdfsGeneratorService {
  private readonly logger = new Logger(PdfsGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Ponto de entrada que delega a geração para o método apropriado com base no tipo de PDF.
   * @returns O buffer de PDF gerado.
   */
  async generatePdfBuffer(
    contractId: string,
    pdfType: PdfType | 'CONTRATO_LOCACAO',
  ): Promise<Buffer> {
    this.logger.log(
      `Solicitação para gerar buffer de PDF do tipo '${pdfType}' para o contrato ${contractId}`,
    );
    switch (pdfType) {
      case 'CONTRATO_LOCACAO':
        return this.generateContractPdf(contractId);
      case PdfType.RELATORIO_JUDICIAL:
        return this.generateJudicialReportPdf(contractId);
      default:
        throw new BadRequestException(
          `Geração de PDF para o tipo '${pdfType}' não é suportada.`,
        );
    }
  }

  /**
   * Gera o PDF de um contrato de locação a partir do HTML personalizado salvo no banco de dados.
   */
  private async generateContractPdf(contractId: string): Promise<Buffer> {
    this.logger.log(
      `Iniciando geração de PDF de Contrato a partir do HTML salvo para o ID: ${contractId}`,
    );
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { landlord: true, tenant: true, property: true },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para geração do PDF.',
      );
    }
    if (!contract.contractHtml) {
      throw new BadRequestException(
        'O conteúdo do contrato (contractHtml) não foi encontrado. Ele precisa ser salvo a partir do editor antes da geração do PDF.',
      );
    }

    // Prepara os dados mais atuais para preencher os placeholders
    const templateData = {
      landlord: contract.landlord,
      tenant: contract.tenant,
      property: contract.property,
      startDate: contract.startDate,
      endDate: contract.endDate,
      durationInMonths: contract.durationInMonths,
      rentAmount: contract.rentAmount.toNumber(),
      condoFee: contract.condoFee?.toNumber(),
      iptuFee: contract.iptuFee?.toNumber(),
      totalAmount:
        contract.rentAmount.toNumber() +
        (contract.condoFee?.toNumber() ?? 0) +
        (contract.iptuFee?.toNumber() ?? 0),
      guaranteeType: contract.guaranteeType,
      securityDeposit: contract.securityDeposit?.toNumber(),
      now: new Date(),
    };

    try {
      // Compila o HTML salvo no banco (vindo do Tiptap) com os dados atuais
      const template = Handlebars.compile(contract.contractHtml);
      const finalHtml = template(templateData);

      // Gera o PDF a partir do HTML final
      return await generatePdfFromHtml(finalHtml);
    } catch (error) {
      this.logger.error(
        `Falha ao compilar o template Handlebars do banco ou gerar o PDF para o contrato ${contractId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Falha ao gerar o documento final do contrato.',
      );
    }
  }

  /**
   * Gera o PDF do relatório judicial a partir de um template HBS.
   */
  private async generateJudicialReportPdf(contractId: string): Promise<Buffer> {
    this.logger.log(
      `Iniciando geração de Relatório Judicial para o contrato ID: ${contractId}`,
    );
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        landlord: true,
        tenant: true,
        property: true,
        paymentsOrders: { include: { charge: true } },
        documents: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar o relatório.',
      );
    }

    const documentsWithBase64 = await Promise.all(
      contract.documents.map(async (doc) => {
        const { buffer } = await this.storageService.getFileBuffer(
          doc.filePath,
        );
        const base64 = buffer.toString('base64');
        const getMimeType = (filePath: string): string => {
          const extension = filePath.split('.').pop()?.toLowerCase() || '';
          switch (extension) {
            case 'pdf':
              return 'application/pdf';
            case 'jpg':
            case 'jpeg':
              return 'image/jpeg';
            case 'png':
              return 'image/png';
            default:
              return 'application/octet-stream';
          }
        };
        const mimeType = getMimeType(doc.filePath);
        return { ...doc, base64: `data:${mimeType};base64,${base64}` };
      }),
    );

    const judicialTemplateData: JudicialReportTemplateData = {
      contract,
      landlord: contract.landlord,
      tenant: contract.tenant,
      property: contract.property,
      payments: contract.paymentsOrders,
      documents: documentsWithBase64,
      signedContractUrl: contract.signedContractFilePath
        ? await this.storageService.getSignedUrl(
            contract.signedContractFilePath,
          )
        : null,
      logs: await this.prisma.log.findMany({ where: { targetId: contractId } }),
      now: new Date(),
      totalAmount:
        contract.rentAmount.toNumber() +
        (contract.condoFee?.toNumber() ?? 0) +
        (contract.iptuFee?.toNumber() ?? 0),
    };

    return generatePdfFromTemplate('RELATORIO_JUDICIAL', judicialTemplateData);
  }
}
