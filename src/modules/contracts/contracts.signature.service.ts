import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { PdfsService } from '../pdfs/pdfs.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ClicksignService } from '../clicksign/clicksign.service';
import { ContractStatus } from '@prisma/client';

@Injectable()
export class ContractSignatureService {
  constructor(
    private prisma: PrismaService,
    private pdfsService: PdfsService,
    private clicksignService: ClicksignService,
  ) {}

  async getContractPdfSignedUrl(contractId: string) {
    const pdf = await this.prisma.generatedPdf.findFirst({
      where: { contractId: contractId, pdfType: 'CONTRATO_LOCACAO' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!pdf) {
      throw new NotFoundException(
        'Nenhum PDF de contrato foi gerado para esta locação ainda.',
      );
    }

    return this.pdfsService.getSignedUrl(pdf.id);
  }

  async resendNotification(
    contractId: string,
    signerId: string,
    currentUser: JwtPayload,
  ) {
    if (
      currentUser.role !== ROLES.LOCADOR &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas locadores ou administradores podem reenviar notificações.',
      );
    }

    const pdf = await this.prisma.generatedPdf.findFirst({
      where: { contractId: contractId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!pdf || !pdf.clicksignEnvelopeId) {
      throw new NotFoundException(
        'Nenhum processo de assinatura ativo (envelope) encontrado para este contrato.',
      );
    }

    const signatureRequest = await this.prisma.signatureRequest.findFirst({
      where: {
        generatedPdfId: pdf.id,
        signerId: signerId,
      },
    });

    if (!signatureRequest || !signatureRequest.clicksignSignerId) {
      throw new NotFoundException(
        'Solicitação de assinatura não encontrada para este usuário no documento.',
      );
    }

    await this.clicksignService.notifySigner(
      pdf.clicksignEnvelopeId,
      signatureRequest.clicksignSignerId,
    );

    return {
      message: `Solicitação de notificação para o signatário foi enviada com sucesso.`,
    };
  }

  async requestSignature(contractId: string, currentUser: JwtPayload) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para solicitar assinaturas.',
      );
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.status !== ContractStatus.AGUARDANDO_ASSINATURAS) {
      throw new BadRequestException(
        `A solicitação de assinatura só pode ser feita para contratos com status 'AGUARDANDO_ASSINATURAS'. O status atual é '${contract.status}'.`,
      );
    }

    return this.pdfsService.initiateSignatureProcess(contractId, currentUser);
  }
}
