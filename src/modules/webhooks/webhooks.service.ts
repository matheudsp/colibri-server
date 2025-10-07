import { Injectable, Logger } from '@nestjs/common';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { HttpService } from '@nestjs/axios';
import { getPdfFileName } from 'src/common/utils/pdf-naming-helper.utils';
import { firstValueFrom } from 'rxjs';
import { SubaccountsService } from '../subaccounts/subaccounts.service';
import { TransfersService } from '../transfers/transfers.service';
import { ContractLifecycleService } from '../contracts/contracts.lifecycle.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly paymentsService: PaymentsOrdersService,
    private readonly prisma: PrismaService,
    private readonly contractLifecycleService: ContractLifecycleService,
    private readonly httpService: HttpService,
    private readonly storageService: StorageService,
    private readonly subaccountsService: SubaccountsService,
    private readonly transfersService: TransfersService,
  ) {}

  async processClicksignEvent(payload: any): Promise<void> {
    const eventName = payload?.event?.name;
    const documentKey = payload?.document?.key;

    if (!eventName || !documentKey) {
      this.logger.warn(
        `[Webhook Clicksign] Payload inválido ou sem document.key recebido.`,
        payload,
      );
      return;
    }

    if (
      eventName === 'close' ||
      eventName === 'auto_close' ||
      eventName === 'document_closed'
    ) {
      this.logger.log(
        `Evento de finalização '${eventName}' recebido para o documento ${documentKey}.`,
      );

      const signatureRequest = await this.prisma.signatureRequest.findFirst({
        where: { clicksignDocumentId: documentKey },
      });

      if (!signatureRequest) {
        this.logger.warn(
          `Nenhuma SignatureRequest encontrada para o documentKey: ${documentKey}`,
        );
        return;
      }
      const { generatedPdfId, clicksignEnvelopeId } = signatureRequest;

      const pdf = await this.prisma.generatedPdf.findUnique({
        where: { id: generatedPdfId },
      });

      if (!pdf) {
        this.logger.warn(
          `Nenhum PDF encontrado para a SignatureRequest: ${signatureRequest.id}`,
        );
        return;
      }

      const signedUrl = payload?.document?.downloads?.signed_file_url;
      if (signedUrl) {
        try {
          this.logger.log(
            `Iniciando download do documento assinado para o contrato ${pdf.contractId}.`,
          );
          const response = await firstValueFrom(
            this.httpService.get(signedUrl, { responseType: 'arraybuffer' }),
          );
          const fileBuffer = Buffer.from(response.data);
          const signedFileName = `assinado-${getPdfFileName(pdf.pdfType, pdf.contractId)}`;
          const { key } = await this.storageService.uploadFile(
            {
              buffer: fileBuffer,
              originalname: signedFileName,
              mimetype: 'application/pdf',
              size: fileBuffer.length,
            },
            { folder: `contracts/${pdf.contractId}` },
          );

          await this.prisma.generatedPdf.update({
            where: { id: pdf.id },
            data: { signedFilePath: key },
          });

          this.logger.log(
            `Documento assinado para o contrato ${pdf.contractId} salvo em: ${key}.`,
          );
        } catch (error) {
          this.logger.error(
            `Falha ao guardar o arquivo assinado do envelope ${clicksignEnvelopeId}.`,
            error,
          );
        }
      } else {
        this.logger.warn(
          `URL do arquivo assinado não encontrada no payload para o documento ${documentKey}.`,
        );
      }

      this.logger.log(
        `Solicitando ativação para o contrato ${pdf.contractId}...`,
      );
      await this.contractLifecycleService.activateContractAfterSignature(
        pdf.contractId,
      );
    } else {
      this.logger.log(
        `[Webhook Clicksign] Evento '${eventName}' recebido e ignorado conforme a regra.`,
      );
    }
  }

  async processAsaasEvent(payload: {
    event: string;
    payment?: any;
    account?: any;
    transfer?: any;
    accountStatus?: any;
  }) {
    const { event, payment, account, transfer, accountStatus } = payload;

    if (!event) {
      this.logger.warn('[Webhook] Payload inválido recebido, evento ausente.');
      return;
    }

    if (payment) {
      const asaasChargeId = payment.id;
      this.logger.log(
        `[Webhook] Evento de PAGAMENTO '${event}' recebido para a cobrança '${asaasChargeId}'.`,
      );

      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          const amountPaid = payment.value;
          const netValue = payment.netValue;
          const paidAt = new Date(payment.paymentDate);
          const transactionReceiptUrl = payment.transactionReceiptUrl;
          await this.paymentsService.confirmPaymentByChargeId(
            asaasChargeId,
            amountPaid,
            netValue,
            paidAt,
            transactionReceiptUrl,
          );
          break;

        case 'PAYMENT_OVERDUE':
          await this.paymentsService.handleOverduePayment(asaasChargeId);
          break;

        case 'PAYMENT_DELETED':
          await this.paymentsService.handleDeletedPayment(asaasChargeId);
          break;

        case 'PAYMENT_RESTORED':
          await this.paymentsService.handleRestoredPayment(asaasChargeId);
          break;

        default:
          this.logger.log(
            `[Webhook] Evento '${event}' não requer ação. Ignorando.`,
          );
          break;
      }
    } else if (accountStatus) {
      const asaasAccountId = accountStatus.id;
      this.logger.log(
        `[Webhook] Evento de CONTA '${event}' recebido para a conta '${asaasAccountId}'.`,
      );

      if (event.startsWith('ACCOUNT_STATUS_')) {
        await this.subaccountsService.handleAccountStatusUpdate(accountStatus);
      }
    } else if (account) {
      const asaasAccountId = account.id;
      this.logger.log(
        `[Webhook] Evento de CONTA '${event}' recebido para a conta '${asaasAccountId}'.`,
      );
      if (event === 'ACCOUNT_UPDATED') {
        await this.subaccountsService.handleAccountStatusUpdate(account);
      }
    } else if (transfer) {
      await this.transfersService.handleTransferStatusUpdate(transfer);
    } else {
      this.logger.warn(
        `[Webhook] Evento '${event}' recebido sem um payload de 'payment' ou 'account'. Ignorando.`,
      );
    }
  }
}
