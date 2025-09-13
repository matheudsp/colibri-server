import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { User, type SubAccount } from '@prisma/client';
import type { Queue } from 'bull';
import {
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
} from 'src/common/interfaces/payment-gateway.interface';
import { formatZipCode } from 'src/common/utils/zip-code.util';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailJobType, type NotificationJob } from 'src/queue/jobs/email.job';
import { QueueName } from 'src/queue/jobs/jobs';

@Injectable()
export class SubaccountsService {
  private readonly logger = new Logger(SubaccountsService.name);

  constructor(
    private prisma: PrismaService,
    private paymentGatewayService: PaymentGatewayService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
  ) {}

  /**
   * Processa eventos de atualização de status da subconta vindos do webhook.
   * @param accountPayload - O objeto 'account' do webhook do Asaas.
   */
  async handleAccountStatusUpdate(accountPayload: any): Promise<void> {
    const { id, general, documentation, commercialInfo, bankAccountInfo } =
      accountPayload;

    const subAccount = await this.prisma.subAccount.findUnique({
      where: { asaasAccountId: id },
      include: {
        user: {
          select: { name: true, email: true },
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

    let notification: NotificationJob | null = null;

    if (general === 'APPROVED') {
      notification = {
        user: subAccount.user,
        notification: {
          title: '✅ Sua conta de recebimentos foi aprovada!',
          message: `Olá, ${subAccount.user.name}. Parabéns! Sua conta foi verificada e aprovada. Você já está apto a receber os pagamentos de aluguel através da plataforma.`,
        },
        action: {
          text: 'Acessar minha carteira',
          path: '/dashboard/finances', // Exemplo de path
        },
      };
    } else if (general === 'REJECTED') {
      notification = {
        user: subAccount.user,
        notification: {
          title: '⚠️ Pendência na sua conta de recebimentos',
          message: `Olá, ${subAccount.user.name}. Identificamos uma pendência na verificação da sua conta. Pode ser necessário reenviar algum documento ou corrigir informações. Acesse a plataforma para mais detalhes.`,
        },
        action: {
          text: 'Verificar Pendências',
          // O ideal é ter uma página que busque e mostre o onboardingUrl novamente
          path: '/dashboard/my-account/onboarding',
        },
      };
    }

    if (notification) {
      await this.emailQueue.add(EmailJobType.NOTIFICATION, notification);
      this.logger.log(
        `Notificação de status de conta enfileirada para ${subAccount.user.email}`,
      );
    }
  }

  async getOrCreateSubaccount(
    user: User & { subAccount: SubAccount | null },
  ): Promise<SubAccount> {
    if (
      user.subAccount &&
      user.subAccount.asaasAccountId &&
      user.subAccount.apiKey &&
      user.subAccount.asaasWalletId
    ) {
      this.logger.log(
        `Subconta completa [${user.subAccount.asaasAccountId}] já existe localmente para o usuário ${user.id}. Retornando dados existentes.`,
      );
      return user.subAccount;
    }

    this.logger.log(
      `Iniciando processo de criação/atualização de subconta para o usuário ${user.id}.`,
    );
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
    console.log(subaccountDto);
    const asaasAccount =
      await this.paymentGatewayService.createWhitelabelSubAccount(
        subaccountDto,
      );

    try {
      const savedSubAccount = await this.prisma.subAccount.upsert({
        where: { userId: user.id },

        update: {
          asaasAccountId: asaasAccount.id,
          apiKey: asaasAccount.apiKey,
          asaasWalletId: asaasAccount.walletId,
          asaasWebhookToken: asaasAccount.authTokenSent,
        },

        create: {
          userId: user.id,
          asaasAccountId: asaasAccount.id,
          apiKey: asaasAccount.apiKey,
          asaasWalletId: asaasAccount.walletId,
          asaasWebhookToken: asaasAccount.authTokenSent,
        },
      });

      // this.logger.log(
      //   `Subconta [${asaasAccount.id}] salva/atualizada no banco de dados para o usuário ${user.id}.`,
      // );
      this.initiateDocumentOnboarding(savedSubAccount, user);
      return savedSubAccount;
    } catch (error) {
      this.logger.error(
        `Falha ao salvar/atualizar a subconta no banco de dados para o usuário ${user.id}`,
        error,
      );
      throw new InternalServerErrorException(
        'A subconta foi criada no gateway, mas falhou ao ser salva localmente.',
      );
    }
  }

  /**
   * Inicia a coleta de documentos após a criação da subconta.
   */
  private async initiateDocumentOnboarding(
    subAccount: SubAccount,
    user: User,
  ): Promise<void> {
    this.logger.log(
      `Aguardando 15 segundos antes de buscar documentos para a subconta ${subAccount.asaasAccountId}...`,
    );
    // Timeout recomendado pela documentação de 15 segundos
    await new Promise((resolve) => setTimeout(resolve, 15000));

    try {
      const documentsInfo =
        await this.paymentGatewayService.getRequiredDocuments(
          subAccount.apiKey,
        );
      const identificationDoc = documentsInfo.data.find(
        (doc) => doc.type === 'IDENTIFICATION',
      );

      if (identificationDoc?.onboardingUrl) {
        // Salva a URL no banco de dados para referência futura
        await this.prisma.subAccount.update({
          where: { id: subAccount.id },
          data: { onboardingUrl: identificationDoc.onboardingUrl },
        });

        // Notifica o usuário para enviar os documentos
        const job: NotificationJob = {
          user: { name: user.name, email: user.email },
          notification: {
            title: 'Ação necessária: Envie seus documentos',
            message: `Sua conta para recebimento de pagamentos foi criada! Para ativá-la, precisamos que você envie alguns documentos para verificação. Por favor, acesse o link seguro para concluir seu cadastro.`,
          },
          action: {
            text: 'Enviar Documentos',
            url: identificationDoc.onboardingUrl,
          },
        };
        await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
        this.logger.log(
          `Notificação de onboarding enviada para o usuário ${user.id}.`,
        );
      } else {
        this.logger.warn(
          `Nenhuma onboardingUrl encontrada para a subconta ${subAccount.asaasAccountId}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Falha ao buscar URL de onboarding para a subconta ${subAccount.asaasAccountId}`,
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
        "É necessário fornecer o 'tipo de empresa' (companyType) para PJ ou a 'data de nascimento' (birthDate) para PF.",
      );
    }
  }
}
