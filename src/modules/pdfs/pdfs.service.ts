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
import { PdfType } from '@prisma/client';
import { LogHelperService } from '../logs/log-helper.service';
import { getPdfFileName } from '../../common/utils/pdf-naming-helper.utils';
import { ROLES } from 'src/common/constants/roles.constant';
import { PdfsGeneratorService } from './pdfs.generator.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';

@Injectable()
export class PdfsService {
  private readonly logger = new Logger(PdfsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly logHelper: LogHelperService,
    private readonly pdfGeneratorService: PdfsGeneratorService,
  ) {}

  // --- MÉTODOS PARA O PDF DO CONTRATO PRINCIPAL ---

  /**
   * Gera o PDF do contrato, salva no storage e atualiza o campo 'contractFilePath' no contrato.
   */
  async generateAndSaveContractPdf(
    contractId: string,
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException('Apenas o locador pode gerar o contrato.');
    }

    this.logger.log(`Gerando PDF do contrato para o ID: ${contractId}`);

    const pdfBuffer = await this.pdfGeneratorService.generatePdfBuffer(
      contractId,
      'CONTRATO_LOCACAO',
    );
    const fileName = getPdfFileName('CONTRATO_LOCACAO', contractId);

    const { key } = await this.storageService.uploadFile(
      {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      },
      { folder: `contracts/${contractId}` },
    );

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { contractFilePath: key },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'GENERATE_CONTRACT_PDF',
      'Contract',
      contractId,
    );
    this.logger.log(`PDF do contrato ${contractId} salvo em: ${key}`);

    return { filePath: key };
  }

  /**
   * Obtém a URL assinada para o PDF do contrato (assinado ou não).
   */
  async getContractSignedUrl(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado.');

    if (
      contract.landlordId !== currentUser.sub &&
      contract.tenantId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException('Acesso não autorizado a este contrato.');
    }

    const pathToFile =
      contract.signedContractFilePath || contract.contractFilePath;
    if (!pathToFile)
      throw new NotFoundException(
        'Nenhum PDF foi gerado para este contrato ainda.',
      );

    return { url: await this.storageService.getSignedUrl(pathToFile) };
  }

  // --- MÉTODOS PARA PDFs ACESSÓRIOS (ex: Relatórios) ---

  /**
   * Gera e salva um PDF acessório (ex: RELATORIO_JUDICIAL) na tabela GeneratedPdf.
   */
  async generateAndSaveAccessoryPdf(
    contractId: string,
    pdfType: PdfType,
    currentUser: JwtPayload,
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para gerar este tipo de PDF.',
      );
    }

    const pdfBuffer = await this.pdfGeneratorService.generatePdfBuffer(
      contractId,
      pdfType,
    );
    const fileName = getPdfFileName(pdfType, contractId);
    const { key } = await this.storageService.uploadFile(
      {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      },
      { folder: `contracts/${contractId}/reports` },
    );

    const newPdf = await this.prisma.generatedPdf.create({
      data: { contractId, filePath: key, generatedAt: new Date(), pdfType },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      `GENERATE_${pdfType}`,
      'GeneratedPdf',
      newPdf.id,
    );
    return newPdf;
  }

  /**
   * Obtém a URL assinada de um PDF acessório específico.
   */
  async getAccessoryPdfSignedUrl(pdfId: string) {
    const pdf = await this.getAccessoryPdfById(pdfId);
    return { url: await this.storageService.getSignedUrl(pdf.filePath) };
  }

  /**
   * Faz o download de um PDF acessório.
   */
  async downloadAccessoryPdf(id: string) {
    const pdf = await this.getAccessoryPdfById(id);

    try {
      const fileStream = await this.storageService.getFileStream(pdf.filePath);
      return {
        fileStream,
        filename: getPdfFileName(pdf.pdfType, pdf.contractId),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(
          `Falha ao preparar o PDF para download: ${error.message}`,
        );
      }
      throw new InternalServerErrorException('Erro desconhecido ao baixar PDF');
    }
  }

  async getAccessoryPdfById(id: string) {
    const pdf = await this.prisma.generatedPdf.findUnique({
      where: { id },
    });
    if (!pdf) {
      throw new NotFoundException('Documento PDF não encontrado.');
    }
    return pdf;
  }

  /**
   * Lista todos os PDFs acessórios de um contrato.
   */
  async findAccessoryPdfsByContract(
    contractId: string,
    currentUser: JwtPayload,
  ) {
    if (currentUser?.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para listar estes documentos.',
      );
    }
    return this.prisma.generatedPdf.findMany({
      where: { contractId },
    });
  }

  /**
   * Deleta todos os PDFs acessórios de um contrato do storage e do banco.
   */
  async deleteAccessoryPdfsByContract(contractId: string) {
    const pdfs = await this.prisma.generatedPdf.findMany({
      where: { contractId },
    });
    if (pdfs.length === 0) return;

    const filePathsToDelete = pdfs.map((pdf) => pdf.filePath);
    await this.storageService.deleteFiles(filePathsToDelete);
    await this.prisma.generatedPdf.deleteMany({ where: { contractId } });
  }

  /**
   * Deleta um PDF acessório específico.
   */
  async deleteAccessoryPdf(id: string, currentUser: JwtPayload) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para deletar PDFs.',
      );
    }

    const pdf = await this.getAccessoryPdfById(id);
    await this.storageService.deleteFile(pdf.filePath);
    return this.prisma.generatedPdf.delete({ where: { id } });
  }
}
