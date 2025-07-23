import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { LogHelperService } from '../logs/log-helper.service';
import { ContractStatus, DocumentStatus, DocumentType } from '@prisma/client';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly logHelper: LogHelperService,
  ) {}

  async uploadDocument(
    contractId: string,
    currentUser: JwtPayload,
    file: Express.Multer.File,
    documentType: DocumentType,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.tenantId !== currentUser.sub &&
      contract.landlordId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para enviar documentos para este contrato.',
      );
    }

    const { key } = await this.storageService.uploadFile(file);

    const document = await this.prisma.document.create({
      data: {
        filePath: key,
        type: documentType,
        contractId: contractId,
        userId: contract.tenantId,
        status: DocumentStatus.AGUARDANDO_APROVACAO,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'UPLOAD',
      'Document',
      document.id,
    );

    return document;
  }

  async findByContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.tenantId !== currentUser.sub &&
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar estes documentos.',
      );
    }

    const documents = await this.prisma.document.findMany({
      where: { contractId },
    });

    // Gera URLs assinadas para acesso seguro aos arquivos
    return Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await this.storageService.getSignedUrl(doc.filePath),
      })),
    );
  }

  async updateStatus(
    documentId: string,
    status: DocumentStatus,
    currentUser: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { contract: true },
    });

    if (!document || !document.contract) {
      throw new NotFoundException(
        'Documento ou contrato associado não encontrado.',
      );
    }

    if (
      document.contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas o locador ou um administrador podem alterar o status dos documentos.',
      );
    }

    const updatedDocument = await this.prisma.document.update({
      where: { id: documentId },
      data: { status },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      `UPDATE_STATUS_TO_${status}`,
      'Document',
      document.id,
    );

    if (
      status === DocumentStatus.APROVADO &&
      document.contract.status === ContractStatus.PENDENTE_DOCUMENTACAO
    ) {
      await this.checkAndAdvanceContractStatus(document.contract.id);
    }

    return updatedDocument;
  }

  private async checkAndAdvanceContractStatus(contractId: string) {
    const requiredDocTypes = [
      DocumentType.IDENTIDADE_FRENTE,
      DocumentType.CPF,
      DocumentType.COMPROVANTE_RENDA,
    ];

    const documents = await this.prisma.document.findMany({
      where: { contractId },
    });

    const hasAllRequiredDocs = requiredDocTypes.every((requiredType) =>
      documents.some(
        (doc) =>
          doc.type === requiredType && doc.status === DocumentStatus.APROVADO,
      ),
    );

    if (hasAllRequiredDocs) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.EM_ANALISE },
      });
      // ATENÇÃO: USAR template de notificação!
      // enfileirar AQUI um e-mail para o locador avisando que a documentação está pronta para análise final.
    }
  }
}
