import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import {
  PdfJobType,
  type GenerateContractPdfJob,
} from 'src/queue/jobs/pdf.job';
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

  async requestSignature(pdfId: string, currentUser: JwtPayload) {
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
      this.logger.error(
        `Tentativa de assinatura falhou: Dados do signatário incompletos para o contrato ${contract.id}.`,
        {
          landlordPhone: contract.landlord.phone,
          tenantPhone: contract.tenant.phone,
        },
      );
      throw new BadRequestException(
        'Não é possível iniciar o processo de assinatura. O locador e o locatário devem ter um número de telefone cadastrado.',
      );
    }

    const originalFileName = getPdfFileName(pdf.pdfType, contract.id);
    const clicksignDocument = await this.clicksignService.createDocument(
      pdf.filePath,
      originalFileName,
    );
    const documentKey = clicksignDocument.document.key;

    await this.prisma.generatedPdf.update({
      where: { id: pdfId },
      data: { clicksignDocumentKey: documentKey },
    });

    const landlordSigner = await this.clicksignService.createSigner({
      email: contract.landlord.email,
      name: contract.landlord.name,
      phone: contract.landlord.phone,
    });
    const tenantSigner = await this.clicksignService.createSigner({
      email: contract.tenant.email,
      name: contract.tenant.name,
      phone: contract.tenant.phone,
    });

    const notificationMessage = `Você foi convidado para assinar o contrato de aluguel referente ao imóvel "${contract.property.title}".\n\nPor favor, clique no link para assinar o documento.`;

    const landlordRequest = await this.clicksignService.addSignerToDocumentList(
      documentKey,
      landlordSigner.signer.key,
      'lessor',
      notificationMessage,
      1,
    );
    const tenantRequest = await this.clicksignService.addSignerToDocumentList(
      documentKey,
      tenantSigner.signer.key,
      'lessee',
      notificationMessage,
      1,
    );

    // const landlordRequestKey = landlordRequest.list.request_signature_key;
    // const tenantRequestKey = tenantRequest.list.request_signature_key;

    // await this.clicksignService.notifyByEmail(landlordRequestKey);
    // await this.clicksignService.notifyByWhatsapp(landlordRequestKey);

    // await this.clicksignService.notifyByEmail(tenantRequestKey);
    // await this.clicksignService.notifyByWhatsapp(tenantRequestKey);

    await this.prisma.signatureRequest.createMany({
      data: [
        {
          generatedPdfId: pdf.id,
          signerId: contract.landlordId,
          requestSignatureKey: landlordRequest.list.request_signature_key,
        },
        {
          generatedPdfId: pdf.id,
          signerId: contract.tenantId,
          requestSignatureKey: tenantRequest.list.request_signature_key,
        },
      ],
    });

    return;
  }

  async initiateSignatureProcess(contractId: string, currentUser: JwtPayload) {
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

    if (pdf.clicksignDocumentKey) {
      this.logger.log(
        `Verificando status do documento existente na Clicksign: ${pdf.clicksignDocumentKey}`,
      );
      const clicksignDoc = await this.clicksignService.getDocument(
        pdf.clicksignDocumentKey,
      );

      if (clicksignDoc && clicksignDoc.document.status === 'running') {
        this.logger.warn(
          `O documento ${pdf.clicksignDocumentKey} já está em processo de assinatura.`,
        );

        throw new BadRequestException(
          'Este contrato já possui um processo de assinatura em andamento. Re-envie notificações para assinar o contrato.',
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
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para gerar PDF',
      );
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { landlord: true, tenant: true, property: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    if (!contract.landlord.street || !contract.property.cep) {
      throw new BadRequestException(
        'Não é possível gerar o contrato. O endereço do locador ou do imóvel está incompleto.',
      );
    }

    if (!Object.values(PdfType).includes(pdfType as PdfType)) {
      throw new Error(`Tipo de PDF inválido: ${pdfType}`);
    }

    const templateData: ContractTemplateData = {
      landlord: {
        name: contract.landlord.name,
        cpfCnpj: contract.landlord.cpfCnpj,
        street: contract.landlord.street ?? '',
        number: contract.landlord.number ?? '',
        province: contract.landlord.province ?? '',
        city: contract.landlord.city ?? '',
        state: contract.landlord.state ?? '',
        email: contract.landlord.email,
      },
      tenant: contract.tenant,
      property: {
        street: contract.property.street ?? '',
        number: contract.property.number,
        complement: contract.property.complement ?? '',
        district: contract.property.district ?? '',
        city: contract.property.city ?? '',
        state: contract.property.state ?? '',
        cep: contract.property.cep ?? '',
      },
      startDate: contract.startDate,
      endDate: contract.endDate,
      durationInMonths: contract.durationInMonths,
      rentAmount: contract.rentAmount.toNumber(),
      condoFee: contract.condoFee?.toNumber(),
      iptuFee: contract.iptuFee?.toNumber(),
      guaranteeType: contract.guaranteeType,
      securityDeposit: contract.securityDeposit?.toNumber(),
      now: new Date(),
    };

    // const formatPdfType = pdfType.replace(/_/g, '_');
    // const pdfBuffer = await generatePdfFromTemplate(
    //   formatPdfType,
    //   templateData,
    // );

    // const file = {
    //   buffer: Buffer.from(pdfBuffer),
    //   originalname: getPdfFileName(pdfType as PdfType, contract.id),
    //   mimetype: 'application/pdf',
    //   size: pdfBuffer.length,
    // };

    // const { key } = await this.storageService.uploadFile(file, {
    //   folder: `contracts/${contract.id}`,
    // });

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
    const jobData: GenerateContractPdfJob = {
      pdfRecordId: newPdf.id,
      templateData: templateData,
      fileName: fileName,
      contractId: contractId,
    };

    await this.pdfQueue.add(PdfJobType.GENERATE_CONTRACT_PDF, jobData);

    await this.logHelper.createLog(
      currentUser.sub,
      'QUEUE_PDF_GENERATION',
      'GeneratedPdf',
      newPdf.id,
    );
    return newPdf;
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
