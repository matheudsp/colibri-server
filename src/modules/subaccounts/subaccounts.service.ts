import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User, type SubAccount } from '@prisma/client';
import type { AsaasDocumentType } from 'src/common/constants/asaas.constants';
import { CreateAsaasSubAccountDto } from 'src/common/interfaces/payment-gateway.interface';
import { formatZipCode } from 'src/common/utils/zip-code.util';
import { FlagsService } from 'src/feature-flags/flags.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserService } from '../users/users.service';

@Injectable()
export class SubaccountsService {
  private readonly logger = new Logger(SubaccountsService.name);

  constructor(
    private prisma: PrismaService,
    private paymentGatewayService: PaymentGatewayService,
    private flagsService: FlagsService,
    private readonly notificationsService: NotificationsService,
    private readonly userService: UserService,
  ) {}

  async handleAccountStatusUpdate(accountPayload: any): Promise<void> {
    const { id, general, documentation, commercialInfo, bankAccountInfo } =
      accountPayload;

    const subAccount = await this.prisma.subAccount.findUnique({
      where: { asaasAccountId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!subAccount || !subAccount.user) {
      this.logger.warn(
        `Subconta com Asaas Account ID ${id} ou usuário associado não encontrada.`,
      );
      return;
    }

    await this.prisma.subAccount.update({
      where: { id: subAccount.id },
      data: {
        statusGeneral: general,
        statusDocumentation: documentation,
        statusCommercialInfo: commercialInfo,
        statusBankAccountInfo: bankAccountInfo,
      },
    });

    this.logger.log(
      `Status da subconta ${subAccount.id} (Asaas: ${id}) atualizado para: ${general}`,
    );

    let notificationTitle = '';
    let notificationMessage = '';
    let actionPath = '/conta?aba=conta-de-pagamentos';

    if (general === 'APPROVED') {
      notificationTitle = '✅ Sua conta de recebimentos foi aprovada!';
      notificationMessage = `Olá, ${subAccount.user.name}. Parabéns! Sua conta foi verificada e aprovada. Você já está apto a receber os pagamentos de aluguel através da plataforma.`;
    } else if (general === 'REJECTED') {
      notificationTitle = '⚠️ Pendência na sua conta de recebimentos';
      notificationMessage = `Olá, ${subAccount.user.name}. Identificamos uma pendência na verificação da sua conta. Pode ser necessário reenviar algum documento ou corrigir informações. Acesse a plataforma para mais detalhes.`;
    }

    if (notificationTitle) {
      await this.notificationsService.create({
        userId: subAccount.user.id,
        user: subAccount.user,
        title: notificationTitle,
        message: notificationMessage,
        action: {
          text: 'Acessar Minha Carteira',
          path: actionPath,
        },
        sendEmail: true,
      });
      this.logger.log(
        `Notificação de status de conta enfileirada para ${subAccount.user.email}`,
      );
    }
  }

  async getOrCreateSubaccount(
    user: User & { subAccount: SubAccount | null },
  ): Promise<SubAccount> {
    if (user.subAccount?.asaasAccountId) {
      this.logger.log(
        `Subconta completa [${user.subAccount.asaasAccountId}] já existe para o usuário ${user.id}.`,
      );
      return user.subAccount;
    }

    const requireApproval = this.flagsService.isEnabled(
      'requireAdminApprovalForSubaccount',
    );

    if (requireApproval) {
      const existingRequest = await this.prisma.subAccount.findUnique({
        where: { userId: user.id },
      });

      if (existingRequest) {
        this.logger.log(
          `Usuário ${user.id} já possui uma solicitação pendente.`,
        );
        return existingRequest;
      }

      const pendingSubAccount = await this.prisma.subAccount.create({
        data: {
          userId: user.id,
          statusGeneral: 'PENDING_ADMIN_APPROVAL',
        },
      });

      const admins = await this.userService.findAdmins();
      for (const admin of admins) {
        await this.notificationsService.create({
          userId: admin.id,
          title: 'Nova Conta para Aprovação',
          message: `O usuário ${user.name} (${user.email}) solicitou a criação de uma conta de pagamentos e aguarda sua aprovação.`,
          action: {
            text: 'Ver Solicitações',
            path: '/admin/subaccounts/pending',
          },
          sendEmail: true,
          user: admin,
        });
      }
      this.logger.log(
        `Solicitação para ${user.id} criada e admins notificados.`,
      );
      return pendingSubAccount;
    } else {
      this.logger.log(`Modo 'allowAll' ativo. Criando subconta no gateway.`);
      return this.completeSubaccountCreation(user);
    }
  }

  async completeSubaccountCreation(user: User): Promise<SubAccount> {
    this.validateUserForSubAccountCreation(user);

    const subaccountDto: CreateAsaasSubAccountDto = {
      name: user.name.trim(),
      email: user.email.trim(),
      cpfCnpj: user.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: user.phone!.trim(),
      incomeValue: user.incomeValue?.toNumber() || 5000,
      address: user.street!.trim(),
      addressNumber: user.number!.trim(),
      province: user.province!.trim(),
      postalCode: formatZipCode(user.cep!),
      ...(user.companyType
        ? { companyType: user.companyType }
        : { birthDate: user.birthDate!.toISOString().split('T')[0] }),
    };

    const asaasAccount =
      await this.paymentGatewayService.createWhitelabelSubAccount(
        subaccountDto,
      );

    const savedSubAccount = await this.prisma.subAccount.upsert({
      where: { userId: user.id },
      update: {
        asaasAccountId: asaasAccount.id,
        apiKey: asaasAccount.apiKey,
        asaasWalletId: asaasAccount.walletId,
        asaasWebhookToken: asaasAccount.authTokenSent,
        statusGeneral: 'PENDING',
      },
      create: {
        userId: user.id,
        asaasAccountId: asaasAccount.id,
        apiKey: asaasAccount.apiKey,
        asaasWalletId: asaasAccount.walletId,
        asaasWebhookToken: asaasAccount.authTokenSent,
        statusGeneral: 'PENDING',
      },
    });

    await this.initiateDocumentOnboarding(savedSubAccount, user);
    return savedSubAccount;
  }

  private async initiateDocumentOnboarding(
    subAccount: SubAccount,
    user: User,
  ): Promise<void> {
    if (!subAccount.asaasAccountId || !subAccount.apiKey) {
      this.logger.error(
        `Tentativa de iniciar onboarding para subconta incompleta: ${subAccount.id}. Abortando.`,
      );
      return;
    }

    this.logger.log(
      `Aguardando 15s para buscar documentos para a subconta ${subAccount.asaasAccountId}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 15000));

    try {
      const documentsInfo =
        await this.paymentGatewayService.getRequiredDocuments(
          subAccount.apiKey,
        );
      const identificationDoc = documentsInfo.data.find(
        (doc: any) => doc.type === 'IDENTIFICATION',
      );

      if (identificationDoc?.onboardingUrl) {
        await this.prisma.subAccount.update({
          where: { id: subAccount.id },
          data: { onboardingUrl: identificationDoc.onboardingUrl },
        });

        await this.notificationsService.create({
          userId: user.id,
          user: { name: user.name, email: user.email },
          title: 'Ação necessária: Envie seus documentos',
          message: `Sua conta para recebimento de pagamentos foi criada! Para ativá-la, precisamos que você envie alguns documentos para verificação. Por favor, acesse o link seguro para concluir seu cadastro.`,
          action: {
            text: 'Enviar Documentos',
            url: identificationDoc.onboardingUrl,
          },
          sendEmail: true,
        });
        this.logger.log(`Notificação de onboarding enviada para ${user.id}.`);
      } else {
        this.logger.warn(
          `Nenhuma onboardingUrl encontrada para a subconta ${subAccount.asaasAccountId}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falha ao buscar URL de onboarding para ${subAccount.asaasAccountId}`,
        error,
      );
    }
  }

  private validateUserForSubAccountCreation(user: User): void {
    const requiredFields: (keyof User)[] = [
      'name',
      'email',
      'cpfCnpj',
      'phone',
      'street',
      'number',
      'province',
      'cep',
    ];

    for (const field of requiredFields) {
      if (!user[field]) {
        throw new BadRequestException(
          `O campo do usuário '${field}' é obrigatório para a criação da subconta.`,
        );
      }
    }

    if (!user.companyType && !user.birthDate) {
      throw new BadRequestException(
        "É necessário fornecer 'companyType' para PJ ou 'birthDate' para PF.",
      );
    }
  }

  async getPendingDocuments(userId: string): Promise<any> {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { userId },
    });

    if (!subAccount?.apiKey) {
      throw new NotFoundException(
        'Conta de pagamentos não encontrada ou não configurada.',
      );
    }

    const requiredDocs = await this.paymentGatewayService.getRequiredDocuments(
      subAccount.apiKey,
    );

    const documentsForUpload = requiredDocs.data.filter(
      (doc: any) => doc.status === 'NOT_SENT' && doc.onboardingUrl === null,
    );

    return documentsForUpload.map((doc: any) => ({
      type: doc.type,
      title: doc.title,
      description: doc.description,
    }));
  }

  async processDocumentUpload(
    userId: string,
    documentType: AsaasDocumentType,
    file: Express.Multer.File,
  ) {
    const subAccount = await this.prisma.subAccount.findUnique({
      where: { userId },
    });

    if (!subAccount || !subAccount.apiKey) {
      throw new NotFoundException(
        'Subconta não encontrada ou não configurada.',
      );
    }

    const requiredDocs = await this.paymentGatewayService.getRequiredDocuments(
      subAccount.apiKey,
    );
    const docGroup = requiredDocs.data.find(
      (doc: any) => doc.type === documentType && doc.onboardingUrl === null,
    );

    if (!docGroup) {
      throw new BadRequestException(
        `O tipo de documento '${documentType}' não é mais necessário ou deve ser enviado via link de onboarding.`,
      );
    }

    const result = await this.paymentGatewayService.uploadDocumentForSubAccount(
      subAccount.apiKey,
      docGroup.id,
      documentType,
      file,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.notificationsService.create({
        userId: user.id,
        user: { name: user.name, email: user.email },
        title: 'Documento Enviado para Análise',
        message: `O documento "${docGroup.title}" foi enviado e está em análise. Avisaremos quando o processo for concluído.`,
        sendEmail: true,
      });
    }

    return {
      message: 'Documento enviado para análise com sucesso.',
      data: result,
    };
  }

  async resendOnboardingEmail(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subAccount: true },
    });

    if (!user || !user.subAccount) {
      throw new NotFoundException('Subconta não encontrada para este usuário.');
    }

    if (!user.subAccount.onboardingUrl) {
      throw new BadRequestException(
        'Nenhum link de onboarding disponível para ser reenviado.',
      );
    }

    if (user.subAccount.statusGeneral === 'APPROVED') {
      return {
        message:
          'Sua conta já foi aprovada e não requer mais o envio de documentos.',
      };
    }

    await this.notificationsService.create({
      userId: user.id,
      user: { name: user.name, email: user.email },
      title: 'Seu Link para Envio de Documentos',
      message: `Olá, ${user.name}. Conforme solicitado, aqui está o seu link para completar o cadastro e enviar os documentos necessários para a ativação da sua conta de recebimentos.`,
      action: {
        text: 'Enviar Documentos',
        url: user.subAccount.onboardingUrl,
      },
      sendEmail: true,
    });

    this.logger.log(`Reenvio do e-mail de onboarding para ${userId}.`);

    return {
      message: 'O e-mail com o link de onboarding foi reenviado com sucesso.',
    };
  }
}
