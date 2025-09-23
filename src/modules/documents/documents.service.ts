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
import { InjectQueue } from '@nestjs/bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { Queue } from 'bull';
import { EmailJobType, type NotificationJob } from 'src/queue/jobs/email.job';
import { SignatureJobType } from 'src/queue/jobs/signature.job';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly logHelper: LogHelperService,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QueueName.SIGNATURE) private readonly signatureQueue: Queue,
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

    const existingDocument = await this.prisma.document.findFirst({
      where: {
        contractId: contractId,
        type: documentType,
      },
    });

    if (existingDocument) {
      // Deleta o arquivo antigo do armazenamento
      await this.storageService.deleteFile(existingDocument.filePath);
      // Deleta o registro antigo do banco de dados
      await this.prisma.document.delete({
        where: { id: existingDocument.id },
      });
    }

    const { key } = await this.storageService.uploadFile(file, {
      folder: `documents/${currentUser.sub}`,
    });

    const document = await this.prisma.document.create({
      data: {
        filePath: key,
        type: documentType,
        contractId: contractId,
        status: DocumentStatus.AGUARDANDO_APROVACAO,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'UPLOAD',
      'Document',
      document.id,
    );

    await this.checkAndAdvanceToReview(contractId);

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
    rejectionReason?: string,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        contract: {
          include: {
            property: { select: { title: true } },
            tenant: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!document || !document.contract || !document.contract.tenant) {
      throw new NotFoundException(
        'Documento, contrato ou usuário associado não encontrado.',
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

    if (status === DocumentStatus.REPROVADO) {
      const job: NotificationJob = {
        user: {
          name: document.contract.tenant.name,
          email: document.contract.tenant.email,
        },
        notification: {
          title: 'Seu Documento foi Reprovado',
          message: `Olá,  ${document.contract.tenant.name}. O documento que você enviou para o contrato do imóvel "${document.contract.property.title}" foi reprovado.\nMotivo: "${rejectionReason || 'Não especificado'}".\nPor favor, acesse a plataforma para enviar um novo documento.`,
        },
        action: {
          text: 'Enviar Documento Novamente',
          path: `/contracts/${document.contract.id}/documents`,
        },
      };
      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }

    if (status === DocumentStatus.APROVADO) {
      await this.checkAndAdvanceToSignatures(document.contract.id);
    }

    return updatedDocument;
  }

  /**
   * Chamado após o UPLOAD. Verifica se todos os tipos de documentos foram ENVIADOS.
   * Se sim, atualiza o status do contrato e notifica o LOCADOR para iniciar a análise.
   */
  private async checkAndAdvanceToReview(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        documents: true,
        landlord: { select: { name: true, email: true } },
        tenant: { select: { name: true } },
        property: { select: { title: true } },
      },
    });

    if (!contract || contract.status !== ContractStatus.PENDENTE_DOCUMENTACAO) {
      return; // O processo já avançou ou o contrato não existe
    }

    const requiredDocTypes = [
      DocumentType.IDENTIDADE_FRENTE,
      DocumentType.IDENTIDADE_VERSO,
      DocumentType.COMPROVANTE_RENDA,
    ];

    const submittedDocTypes = new Set(
      contract.documents.map((doc) => doc.type),
    );
    const hasAllDocsBeenSubmitted = requiredDocTypes.every((type) =>
      submittedDocTypes.has(type),
    );

    if (hasAllDocsBeenSubmitted) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.EM_ANALISE },
      });

      const job: NotificationJob = {
        user: {
          name: contract.landlord.name,
          email: contract.landlord.email,
        },
        notification: {
          title: 'Documentos Prontos para Análise',
          message: `Olá, ${contract.landlord.name}. O locatário ${contract.tenant.name} enviou todos os documentos necessários para o imóvel "${contract.property.title}". Por favor, acesse a plataforma para verificá-los.`,
        },
        action: {
          text: 'Verificar Documentos',
          path: `/contracts/${contract.id}/documents`,
        },
      };

      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }
  }

  /**
   * Chamado após a APROVAÇÃO de um documento. Verifica se todos foram APROVADOS.
   * Se sim, atualiza o status do contrato e notifica AMBAS AS PARTES.
   */
  private async checkAndAdvanceToSignatures(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        documents: { where: { status: DocumentStatus.APROVADO } },
        landlord: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            emailVerified: true,
          },
        },
        tenant: { select: { name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (!contract || contract.status !== ContractStatus.EM_ANALISE) {
      return;
    }

    const requiredDocTypes = [
      DocumentType.IDENTIDADE_FRENTE,
      DocumentType.CPF,
      DocumentType.COMPROVANTE_RENDA,
    ];

    const approvedDocTypes = new Set(contract.documents.map((doc) => doc.type));
    const hasAllDocsBeenApproved = requiredDocTypes.every((type) =>
      approvedDocTypes.has(type),
    );

    if (hasAllDocsBeenApproved) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.AGUARDANDO_ASSINATURAS },
      });

      await this.signatureQueue.add(
        SignatureJobType.INITIATE_SIGNATURE_PROCESS,
        {
          contractId: contract.id,
          userId: contract.landlord.id,
          userRole: contract.landlord.role,
          userEmail: contract.landlord.email,
          userIsActive: contract.landlord.status,
          userIsVerified: contract.landlord.emailVerified,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
        },
      );

      // As notificações de "documento enviado para assinatura" já são tratadas pela Clicksign.
      //    const landlordJob: NotificationJob = {
      //   user: {
      //     name: contract.landlord.name,
      //     email: contract.landlord.email,
      //   },
      //   notification: {
      //     title: 'Documentação Aprovada! Próximo Passo: Assinaturas',
      //     message: `Olá, ${contract.landlord.name}. Você aprovou todos os documentos do locatário ${contract.tenant.name} para o imóvel "${contract.property.title}". O contrato agora está pronto para as assinaturas.`,
      //   },
      //   action: {
      //     text: 'Ver Contrato',
      //     path: `/contracts/${contract.id}`,
      //   },
      // };
      // await this.emailQueue.add(EmailJobType.NOTIFICATION, landlordJob);

      // // Notificação para o Locatário
      // const tenantJob: NotificationJob = {
      //   user: {
      //     name: contract.tenant.name,
      //     email: contract.tenant.email,
      //   },
      //   notification: {
      //     title: 'Boas notícias! Sua documentação foi aprovada',
      //     message: `Parabéns, ${contract.tenant.name}! Sua documentação para o imóvel "${contract.property.title}" foi totalmente aprovada pelo locador. O próximo passo é a assinatura do contrato.`,
      //   },
      //   action: {
      //     text: 'Ver Contrato',
      //     path: `/contracts/${contract.id}`,
      //   },
      // };
      // await this.emailQueue.add(EmailJobType.NOTIFICATION, tenantJob);
    }
  }
}
