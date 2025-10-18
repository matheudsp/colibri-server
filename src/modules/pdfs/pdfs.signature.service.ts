import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { ClicksignService } from '../clicksign/clicksign.service';
import { PdfsGeneratorService } from './pdfs.generator.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { getPdfFileName } from '../../common/utils/pdf-naming-helper.utils';
import { PdfsService } from './pdfs.service';

@Injectable()
export class PdfsSignatureService {
  private readonly logger = new Logger(PdfsSignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfsService: PdfsService,
    private readonly pdfGeneratorService: PdfsGeneratorService,
    private readonly clicksignService: ClicksignService,
  ) {}

  async initiateSignatureProcess(
    contractId: string,
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para iniciar um processo de assinatura.',
      );
    }

    let contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { landlord: true, tenant: true },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (!contract.contractFilePath) {
      this.logger.log(
        `Nenhum PDF encontrado para o contrato ${contractId}. Gerando um novo...`,
      );
      const { filePath } = await this.pdfsService.generateAndSaveContractPdf(
        contractId,
        currentUser,
      );
      contract.contractFilePath = filePath;
    }

    if (contract.clicksignEnvelopeId) {
      const envelope = await this.clicksignService.getEnvelope(
        contract.clicksignEnvelopeId,
      );
      if (envelope && envelope.data.attributes.status === 'in_progress') {
        throw new BadRequestException(
          'Este contrato já possui um processo de assinatura em andamento.',
        );
      }
    }

    this.logger.log(
      `Iniciando um novo processo de assinatura para o contrato ${contract.id}...`,
    );
    return this.requestSignature(contract);
  }

  private async requestSignature(contract: any) {
    if (!contract.landlord.phone || !contract.tenant.phone) {
      throw new BadRequestException(
        'O locador e o locatário devem ter um número de telefone cadastrado.',
      );
    }

    try {
      const originalFileName = getPdfFileName('CONTRATO_LOCACAO', contract.id);
      const envelope = await this.clicksignService.createEnvelope(contract.id);
      const document = await this.clicksignService.addDocumentToEnvelope(
        envelope.id,
        contract.contractFilePath,
        originalFileName,
      );

      await this.prisma.contract.update({
        where: { id: contract.id },
        data: { clicksignEnvelopeId: envelope.id },
      });

      const landlordSigner = await this.addSignerAndRequirements(
        envelope.id,
        document.id,
        contract.landlord,
        'lessor',
      );
      const tenantSigner = await this.addSignerAndRequirements(
        envelope.id,
        document.id,
        contract.tenant,
        'lessee',
      );

      await this.prisma.signatureRequest.createMany({
        data: [
          {
            contractId: contract.id,
            signerId: contract.landlordId,
            clicksignSignerId: landlordSigner.id,
            clicksignDocumentId: document.id,
            clicksignEnvelopeId: envelope.id,
          },
          {
            contractId: contract.id,
            signerId: contract.tenantId,
            clicksignSignerId: tenantSigner.id,
            clicksignDocumentId: document.id,
            clicksignEnvelopeId: envelope.id,
          },
        ],
      });

      await this.clicksignService.activateEnvelope(envelope.id);
      await this.clicksignService.notifyAllSigners(envelope.id);

      return {
        message:
          'Processo de assinatura iniciado e notificações enviadas com sucesso.',
      };
    } catch (error) {
      this.logger.error(
        'Falha crítica ao iniciar o processo de assinatura na Clicksign.',
        { error: error.response?.data || error.message },
      );
      throw new InternalServerErrorException(
        'Não foi possível iniciar o processo de assinatura.',
      );
    }
  }

  private async addSignerAndRequirements(
    envelopeId: string,
    documentId: string,
    user: any,
    role: 'lessor' | 'lessee',
  ) {
    const isPF = user.cpfCnpj.length === 11;
    const signerData = {
      name: user.name,
      email: user.email,
      phone_number: user.phone,
      has_documentation: isPF,
      documentation: isPF
        ? user.cpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
        : undefined,
      birthday: isPF ? user.birthDate?.toISOString().split('T')[0] : undefined,
    };

    const signer = await this.clicksignService.addSignerToEnvelope(
      envelopeId,
      signerData,
    );
    await this.clicksignService.addRequirementsToSigner(
      envelopeId,
      documentId,
      signer.id,
      role,
    );
    return signer;
  }
}
