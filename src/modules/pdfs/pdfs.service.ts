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
  ) {}

  async requestSignature(
    pdfId: string,
    currentUser: { sub: string; role: string },
  ) {
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
    const originalFileName = getPdfFileName(pdf.pdfType, contract.id);

    this.logger.log(
      `Etapa 1: Criando o documento "${originalFileName}" na Clicksign...`,
    );
    const clicksignDocument = await this.clicksignService.createDocument(
      pdf.filePath,
      originalFileName,
    );
    const documentKey = clicksignDocument.document.key;
    this.logger.log(`Documento criado com a chave: ${documentKey}.`);

    this.logger.log('Etapa 2: Criando signatários...');
    const landlordSigner = await this.clicksignService.createSigner({
      email: contract.landlord.email,
      name: contract.landlord.name,
    });
    const tenantSigner = await this.clicksignService.createSigner({
      email: contract.tenant.email,
      name: contract.tenant.name,
    });
    const landlordSignerKey = landlordSigner.signer.key;
    const tenantSignerKey = tenantSigner.signer.key;
    this.logger.log(
      `Signatários criados: ${landlordSignerKey} (Locador), ${tenantSignerKey} (Locatário)`,
    );

    this.logger.log('Etapa 3: Vinculando signatários ao documento...');
    const landlordSignatureRequest =
      await this.clicksignService.addSignerToDocumentList(
        documentKey,
        landlordSignerKey,
        'lessor',
      );
    await this.clicksignService.addSignerToDocumentList(
      documentKey,
      tenantSignerKey,
      'lessee',
    );
    this.logger.log('Signatários vinculados e notificados com sucesso.');

    const requestSignatureKey =
      landlordSignatureRequest.list.request_signature_key;

    return this.prisma.generatedPdf.update({
      where: { id: pdfId },
      data: { requestSignatureKey: requestSignatureKey },
    });
  }

  async initiateSignatureProcess(contractId: string, currentUser: JwtPayload) {
    let pdf = await this.prisma.generatedPdf.findFirst({
      where: {
        contractId: contractId,
        pdfType: PdfType.CONTRATO_LOCACAO,
      },
    });

    if (!pdf) {
      this.logger.log(
        `Nenhum PDF encontrado para o contrato ${contractId}. Gerando um novo...`,
      );
      pdf = await this.generatePdf(
        contractId,
        PdfType.CONTRATO_LOCACAO,
        currentUser,
      );
      this.logger.log(`PDF ${pdf.id} gerado para o contrato ${contractId}.`);
    } else {
      this.logger.log(
        `PDF ${pdf.id} existente encontrado para o contrato ${contractId}.`,
      );
    }

    await this.requestSignature(pdf.id, currentUser);
    this.logger.log(
      `Processo de assinatura para o PDF ${pdf.id} iniciado com sucesso.`,
    );

    return { message: 'Processo de assinatura iniciado com sucesso.' };
  }

  async retrySignatureRequest(contractId: string, currentUser: JwtPayload) {
    this.logger.log(
      `Iniciando retentativa manual de assinatura para o contrato: ${contractId}`,
    );

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.status !== ContractStatus.AGUARDANDO_ASSINATURAS) {
      throw new BadRequestException(
        `O contrato não está no status 'AGUARDANDO_ASSINATURAS', e sim '${contract.status}'. A operação não pode ser refeita.`,
      );
    }

    return this.initiateSignatureProcess(contractId, currentUser);
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

    const formatPdfType = pdfType.replace(/_/g, '_');
    const pdfBuffer = await generatePdfFromTemplate(
      formatPdfType,
      templateData,
    );

    const file = {
      buffer: Buffer.from(pdfBuffer),
      originalname: getPdfFileName(pdfType as PdfType, contract.id),
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    };

    const { key } = await this.storageService.uploadFile(file, {
      folder: `contracts/${contract.id}`,
    });
    const newPdf = await this.prisma.generatedPdf.create({
      data: {
        contractId,
        filePath: key,
        generatedAt: new Date(),
        pdfType: pdfType as PdfType,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'CREATE',
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

  async downloadPdf(id: string, currentUser?: { role: string }) {
    if (currentUser?.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para fazer download do PDF',
      );
    }

    const pdf = await this.getPdfById(id, currentUser);

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

  async getPdfById(id: string, currentUser?: { role: string }) {
    if (currentUser?.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para visualizar PDF',
      );
    }

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
