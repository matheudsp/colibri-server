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
import { CurrencyUtils } from 'src/common/utils/currency.utils';
import { format } from 'date-fns';
import { EnumUtils } from 'src/common/utils/enum.utils';
import { cpfCnpjUtils } from 'src/common/utils/cpfCnpj.utils';
import type { ContractTemplateData } from './types/contract-template.interface';

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
    if (!contract.landlord || !contract.tenant || !contract.property) {
      this.logger.error(
        `Dados relacionados (locador, locatário ou imóvel) ausentes para o contrato ${contractId}.`,
      );
      throw new InternalServerErrorException(
        'Falha ao carregar dados completos do contrato para gerar o PDF.',
      );
    }
    // Prepara os dados mais atuais para preencher os placeholders
    const templateData: ContractTemplateData = {
      landlord: {
        name: contract.landlord.name,
        cpfCnpj: cpfCnpjUtils.formatCpfCnpj(contract.landlord.cpfCnpj),
        street: contract.landlord.street,
        number: contract.landlord.number,
        province: contract.landlord.province,
        city: contract.landlord.city,
        state: contract.landlord.state,
        email: contract.landlord.email,
      },
      property: {
        title: contract.property.title,
        street: contract.property.street,
        number: contract.property.number,
        complement: contract.property.complement?.toString() || '',
        district: contract.property.district,
        city: contract.property.city,
        state: contract.property.state,
        cep: contract.property.cep,
        propertyType: contract.property.propertyType,
      },
      tenant: {
        name: contract.tenant.name,
        cpfCnpj: cpfCnpjUtils.formatCpfCnpj(contract.tenant.cpfCnpj),
        email: contract.tenant.email,
      },
      contract: {
        totalAmount:
          CurrencyUtils.formatCurrency(
            contract.rentAmount.toNumber() +
              (contract.condoFee?.toNumber() ?? 0) +
              (contract.iptuFee?.toNumber() ?? 0),
          ) || 'R$ 0,00',
        rentAmount:
          CurrencyUtils.formatCurrency(contract.rentAmount.toNumber()) ||
          'R$ 0,00',
        condoFee: CurrencyUtils.formatCurrency(contract.condoFee?.toNumber()),
        iptuFee: CurrencyUtils.formatCurrency(contract.iptuFee?.toNumber()),
        securityDeposit: CurrencyUtils.formatCurrency(
          contract.securityDeposit?.toNumber(),
        ),
        durationInMonths: contract.durationInMonths.toString(),
        guaranteeType: EnumUtils.formatGuaranteeType(contract.guaranteeType),
        startDateDay: format(new Date(contract.startDate), 'dd'),
        startDate: format(new Date(contract.startDate), 'dd/MM/yyyy'),
        endDate: format(new Date(contract.endDate), 'dd/MM/yyyy'),
      },
      todayDate: format(new Date(), 'dd/MM/yyyy'),
    };

    try {
      const template = Handlebars.compile(contract.contractHtml);
      const finalHtml = template(templateData);

      return await generatePdfFromHtml(finalHtml);
    } catch (error) {
      this.logger.error(
        `Falha ao compilar o template Handlebars do banco (${contract.id}) ou gerar o PDF: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Falha ao gerar o documento final do contrato. Verifique os logs para detalhes. Erro: ${error.message}`,
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
