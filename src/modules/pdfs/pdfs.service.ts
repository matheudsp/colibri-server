import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { generatePdfFromTemplate } from './utils/pdf-generator';
import { ContractStatus, PdfType } from '@prisma/client';
import { LogHelperService } from '../logs/log-helper.service';
import { ContractTemplateData } from './types/contract-template.interface';
import { getPdfFileName } from '../../common/utils/pdf-naming-helper.utils';
import { ROLES } from 'src/common/constants/roles.constant';
import { ClicksignService } from '../clicksign/clicksign.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { InjectQueue } from '@nestjs/bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { Queue } from 'bull';
import { PdfJobType, type GeneratePdfJob } from 'src/queue/jobs/pdf.job';
import type { JudicialReportTemplateData } from './types/judicial-report-template.interface';
// import { ContractsService } from '../contracts/contracts.service';

@Injectable()
export class PdfsService {
  private readonly logger = new Logger(PdfsService.name);
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private logHelper: LogHelperService,
    // private contractService: ContractsService,
    private clicksignService: ClicksignService,
    @InjectQueue(QueueName.PDF) private pdfQueue: Queue,
  ) {}
  async getSignedUrl(pdfId: string) {
    const pdf = await this.getPdfById(pdfId);

    if (!pdf) {
      throw new NotFoundException('PDF não encontrado.');
    }

    const pathToUse = pdf.signedFilePath || pdf.filePath;

    const signedUrl = await this.storageService.getSignedUrl(pathToUse);
    return { url: signedUrl };
  }

  async requestSignature(pdfId: string, currentUser: { role: string }) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para solicitar assinaturas.',
      );
    }
    const pdf = await this.prisma.generatedPdf.findUnique({
      where: { id: pdfId },
      include: {
        contract: { include: { landlord: true, tenant: true, property: true } },
      },
    });

    if (!pdf) throw new NotFoundException('PDF não encontrado');
    const { contract } = pdf;

    if (!contract.landlord.phone || !contract.tenant.phone) {
      throw new BadRequestException(
        'O locador e o locatário devem ter um número de telefone cadastrado.',
      );
    }

    try {
      const originalFileName = getPdfFileName(pdf.pdfType, contract.id);

      // PASSO 1: Criar Envelope
      const envelope =
        await this.clicksignService.createEnvelope(originalFileName);

      // PASSO 2: Adicionar Documento
      const document = await this.clicksignService.addDocumentToEnvelope(
        envelope.id,
        pdf.filePath,
        originalFileName,
      );
      await this.prisma.generatedPdf.update({
        where: { id: pdfId },
        data: { clicksignEnvelopeId: envelope.id },
      });
      const isLandlordPF = contract.landlord.cpfCnpj.length === 11;
      const isTenantPF = contract.tenant.cpfCnpj.length === 11;
      const landlordSignerData = {
        name: contract.landlord.name,
        email: contract.landlord.email,
        phone_number: contract.landlord.phone,
        // Envia documentação e aniversário ape/nas se for Pessoa Física
        has_documentation: isLandlordPF ? true : false,
        documentation: isLandlordPF
          ? contract.landlord.cpfCnpj.replace(
              /(\d{3})(\d{3})(\d{3})(\d{2})/,
              '$1.$2.$3-$4',
            )
          : undefined,
        birthday: isLandlordPF
          ? contract.landlord.birthDate?.toISOString().split('T')[0]
          : undefined,
      };
      const landlordSigner = await this.clicksignService.addSignerToEnvelope(
        envelope.id,
        landlordSignerData,
      );
      await this.clicksignService.addRequirementsToSigner(
        envelope.id,
        document.id,
        landlordSigner.id,
        'lessor',
      );

      const tenantSignerData = {
        name: contract.tenant.name,
        email: contract.tenant.email,
        phone_number: contract.tenant.phone,
        has_documentation: isTenantPF ? true : false,
        documentation: isTenantPF
          ? contract.tenant.cpfCnpj.replace(
              /(\d{3})(\d{3})(\d{3})(\d{2})/,
              '$1.$2.$3-$4',
            )
          : undefined,
        birthday: contract.tenant.birthDate?.toISOString().split('T')[0],
      };
      const tenantSigner = await this.clicksignService.addSignerToEnvelope(
        envelope.id,
        tenantSignerData,
      );
      await this.clicksignService.addRequirementsToSigner(
        envelope.id,
        document.id,
        tenantSigner.id,
        'lessee',
      );

      await this.prisma.signatureRequest.createMany({
        data: [
          {
            generatedPdfId: pdf.id,
            signerId: contract.landlordId,
            clicksignSignerId: landlordSigner.id,
            clicksignDocumentId: document.id,
            clicksignEnvelopeId: envelope.id,
          },
          {
            generatedPdfId: pdf.id,
            signerId: contract.tenantId,
            clicksignSignerId: tenantSigner.id,
            clicksignDocumentId: document.id,
            clicksignEnvelopeId: envelope.id,
          },
        ],
      });

      await this.clicksignService.activateEnvelope(envelope.id);
      this.logger.log(
        `Disparando notificação inicial para o envelope ${envelope.id}`,
      );
      await this.clicksignService.notifyAllSigners(envelope.id);

      return {
        message:
          'Processo de assinatura iniciado e notificações enviadas com sucesso.',
      };
    } catch (error) {
      this.logger.error(
        'Falha crítica ao iniciar o processo de assinatura na Clicksign.',
        {
          error: error.response?.data || error.message,
        },
      );
      throw new InternalServerErrorException(
        'Não foi possível iniciar o processo de assinatura. Verifique os logs.',
      );
    }
  }

  async initiateSignatureProcess(
    contractId: string,
    currentUser: { role: string; sub: string },
  ) {
    let pdf = await this.prisma.generatedPdf.findFirst({
      where: { contractId, pdfType: PdfType.CONTRATO_LOCACAO },
      orderBy: { generatedAt: 'desc' },
    });

    if (!pdf) {
      pdf = await this.generatePdf(
        contractId,
        PdfType.CONTRATO_LOCACAO,
        currentUser,
      );
    }

    if (pdf.clicksignEnvelopeId) {
      this.logger.log(
        `Verificando status do envelope existente na Clicksign: ${pdf.clicksignEnvelopeId}`,
      );
      const envelope = await this.clicksignService.getEnvelope(
        pdf.clicksignEnvelopeId,
      );

      // Na API v3, o status "em andamento" é 'in_progress'
      if (envelope && envelope.data.attributes.status === 'in_progress') {
        this.logger.warn(
          `O envelope ${pdf.clicksignEnvelopeId} já está em processo de assinatura.`,
        );

        throw new BadRequestException(
          'Este contrato já possui um processo de assinatura em andamento. Para notificar os signatários novamente, use a função de reenviar notificações.',
        );
      }
    }

    this.logger.log(
      `Nenhum processo de assinatura ativo encontrado. Iniciando um novo para o PDF ${pdf.id}...`,
    );
    return this.requestSignature(pdf.id, currentUser);
  }

  async generatePdf(
    contractId: string,
    pdfType: PdfType,
    currentUser: { role: string; sub: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para gerar PDF',
      );
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        landlord: true,
        tenant: true,
        property: true,
        paymentsOrders: { include: { bankSlip: true } },
        documents: true,
        GeneratedPdf: { where: { pdfType: 'CONTRATO_LOCACAO' } },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    let templateData: ContractTemplateData | JudicialReportTemplateData;
    let templateName: string;

    switch (pdfType) {
      case PdfType.CONTRATO_LOCACAO:
        if (!contract.landlord.street || !contract.property.cep) {
          throw new BadRequestException(
            'Não é possível gerar o contrato. O endereço do locador ou do imóvel está incompleto.',
          );
        }
        templateName = 'CONTRATO_LOCACAO';
        templateData = {
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
        break;

      case PdfType.RELATORIO_JUDICIAL:
        templateName = 'RELATORIO_JUDICIAL';
        const signedContractPdf = contract.GeneratedPdf.find(
          (p) => p.signedFilePath,
        );
        const documentsWithUrls = await Promise.all(
          contract.documents.map(async (doc) => ({
            ...doc,
            url: await this.storageService.getSignedUrl(
              doc.filePath,
              undefined,
              60 * 60 * 24 * 30,
            ), // URL válida por 30 dias
          })),
        );
        templateData = {
          contract,
          landlord: contract.landlord,
          tenant: contract.tenant,
          property: contract.property,
          payments: contract.paymentsOrders,
          documents: documentsWithUrls,
          signedContractUrl: signedContractPdf?.signedFilePath
            ? await this.storageService.getSignedUrl(
                signedContractPdf.signedFilePath,
              )
            : null,
          logs: await this.prisma.log.findMany({
            where: { targetId: contractId },
          }),
          now: new Date(),
          totalAmount:
            contract.rentAmount.toNumber() +
            (contract.condoFee?.toNumber() ?? 0) +
            (contract.iptuFee?.toNumber() ?? 0),
        };
        break;

      default:
        throw new BadRequestException(`Tipo de PDF inválido: ${pdfType}`);
    }

    const fileName = getPdfFileName(pdfType, contractId);
    const tempFilePath = `contracts/${contractId}/generating-${fileName}`;
    const newPdf = await this.prisma.generatedPdf.create({
      data: {
        contractId,
        filePath: tempFilePath,
        generatedAt: new Date(),
        pdfType: pdfType,
      },
    });
    const jobData: GeneratePdfJob = {
      pdfRecordId: newPdf.id,
      templateData: templateData,
      fileName: fileName,
      contractId: contractId,
      templateName: templateName as 'CONTRATO_LOCACAO' | 'RELATORIO_JUDICIAL',
    };

    const job = await this.pdfQueue.add(PdfJobType.GENERATE_PDF, jobData);

    try {
      await job.finished();
      this.logger.log(
        `Job de geração de PDF ${job.id} para o registro ${newPdf.id} foi concluído.`,
      );
    } catch (error) {
      this.logger.error(`Job de geração de PDF ${job.id} falhou.`, error);
      throw new InternalServerErrorException('Falha ao gerar o documento PDF.');
    }

    await this.logHelper.createLog(
      currentUser.sub,
      'QUEUE_PDF_GENERATION',
      'GeneratedPdf',
      newPdf.id,
    );

    const updatedPdf = await this.prisma.generatedPdf.findUnique({
      where: { id: newPdf.id },
    });
    if (!updatedPdf) {
      throw new NotFoundException(
        'Não foi possível encontrar o PDF após a geração.',
      );
    }
    return updatedPdf;
  }

  async signPdf(
    id: string,
    signedFile: Express.Multer.File,
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para assinar PDF',
      );
    }

    const pdf = await this.getPdfById(id);
    if (!pdf) {
      throw new NotFoundException('PDF não encontrado');
    }
    const contract = await this.prisma.contract.findUnique({
      where: { id: pdf.contractId },
    });
    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const uploadResult = await this.storageService.uploadFile({
      buffer: signedFile.buffer,
      originalname: getPdfFileName(pdf.pdfType, contract.id),
      mimetype: 'application/pdf',
      size: signedFile.size,
    });

    return this.updateSignedPdf(id, uploadResult.key, currentUser);
  }

  async updateSignedPdf(
    pdfId: string,
    signedFilePath: string,
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para atualizar PDF',
      );
    }

    await this.logHelper.createLog(currentUser.sub, 'UPDATE', 'Pdf', pdfId);

    return this.prisma.generatedPdf.update({
      where: { id: pdfId },
      data: { signedFilePath },
    });
  }

  async downloadPdf(id: string) {
    const pdf = await this.getPdfById(id);

    if (!pdf) {
      throw new NotFoundException('PDF não encontrado');
    }

    try {
      const fileStream = await this.storageService.getFileStream(pdf.filePath);
      const contract = await this.prisma.contract.findUnique({
        where: { id: pdf.contractId },
      });

      if (!contract) {
        throw new NotFoundException('Contrato não encontrado');
      }

      return {
        fileStream,
        filename: getPdfFileName(pdf.pdfType, contract.id),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Falha ao preparar o PDF para download: ${error.message}`,
        );
      }
    }
  }

  async getPdfById(id: string) {
    const pdf = await this.prisma.generatedPdf.findUnique({
      where: { id },
    });

    if (!pdf) {
      throw new NotFoundException('Pdf não encontrado');
    }

    return pdf;
  }

  async findByContract(contractId: string, currentUser?: { role: string }) {
    if (currentUser?.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para listar PDFs',
      );
    }

    return this.prisma.generatedPdf.findMany({
      where: { contractId },
    });
  }
  async deletePdfsByContract(contractId: string) {
    this.logger.log(
      `A iniciar a exclusão de todos os PDFs para o contrato ${contractId}...`,
    );

    const pdfs = await this.prisma.generatedPdf.findMany({
      where: { contractId },
    });

    if (pdfs.length === 0) {
      return;
    }

    const filePathsToDelete: string[] = [];
    pdfs.forEach((pdf) => {
      if (pdf.filePath && !pdf.filePath.includes('generating-')) {
        filePathsToDelete.push(pdf.filePath);
      }
      if (pdf.signedFilePath) {
        filePathsToDelete.push(pdf.signedFilePath);
      }
    });

    if (filePathsToDelete.length > 0) {
      await this.storageService.deleteFiles(filePathsToDelete);
      this.logger.log(
        `${filePathsToDelete.length} ficheiro(s) PDF do contrato ${contractId} apagados do storage.`,
      );
    }

    await this.prisma.generatedPdf.deleteMany({
      where: { contractId },
    });
  }

  async deletePdf(id: string, currentUser: { sub: string; role: string }) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para deletar PDF',
      );
    }

    const pdf = await this.getPdfById(id);
    if (!pdf) {
      throw new NotFoundException('PDF não encontrado');
    }

    await this.storageService.deleteFile(pdf.filePath);

    if (pdf.signedFilePath) {
      await this.storageService.deleteFile(pdf.signedFilePath);
    }

    return this.prisma.generatedPdf.delete({
      where: { id },
    });
  }
}
