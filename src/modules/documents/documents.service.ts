import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { LogHelperService } from '../logs/log-helper.service';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';

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
}
