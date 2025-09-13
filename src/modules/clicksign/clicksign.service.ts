import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StorageService } from 'src/storage/storage.service';

interface ClicksignSignerInput {
  name: string;
  email: string;
  phone_number?: string | null;
  documentation?: string;
  birthday?: string;
  has_documentation?: boolean;
  refusable?: boolean;
  group?: number;
  location_required_enabled?: boolean;
  communicate_events?: {
    signature_request?: 'none' | 'email' | 'whatsapp' | 'sms';
    signature_reminder?: 'none' | 'email';
    document_signed?: 'email' | 'whatsapp';
  };
}

@Injectable()
export class ClicksignService {
  private readonly logger = new Logger(ClicksignService.name);
  private readonly accessToken: string;
  private readonly apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly storageService: StorageService,
  ) {
    this.accessToken =
      this.configService.getOrThrow<string>('CLICKSIGN_API_KEY');
    this.apiUrl = this.configService.getOrThrow<string>('CLICKSIGN_API_URL');
  }

  private getHeaders() {
    // Headers da API v3
    return {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      'X-Clicksign-Api-Key': this.accessToken,
    };
  }

  async createEnvelopeWithDocument(
    filePath: string,
    originalFileName: string,
  ): Promise<any> {
    // Criar o Envelope
    const envelopeUrl = `${this.apiUrl}/api/v3/envelopes`;
    const envelopePayload = {
      data: {
        type: 'envelopes',
        attributes: {
          name: `Contrato de Locação - ${originalFileName}`,
          remind_interval: 14, // Lembretes a cada 14 dias

          locale: 'pt-BR',
          auto_close: false,
          defaultl_subject: 'Quase lá, falta pouco para inicar sua locação!',
          default_message:
            'Por favor, assine o documento abaixo digitalmente para prosseguir.',
        },
      },
    };
    const envelopeResponse = await firstValueFrom(
      this.httpService.post(envelopeUrl, envelopePayload, {
        headers: this.getHeaders(),
      }),
    );
    const envelopeId = envelopeResponse.data.data.id;
    this.logger.log(`Envelope ${envelopeId} criado com sucesso.`);

    //  Adicionar o Documento ao Envelope
    const documentUrl = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/documents`;
    const { buffer: fileBuffer } =
      await this.storageService.getFileBuffer(filePath);
    const fileBase64 = fileBuffer.toString('base64');

    const documentPayload = {
      data: {
        type: 'documents',
        attributes: {
          file_base64: `data:application/pdf;base64,${fileBase64}`,
          name: originalFileName,
        },
      },
    };
    await firstValueFrom(
      this.httpService.post(documentUrl, documentPayload, {
        headers: this.getHeaders(),
      }),
    );
    this.logger.log(
      `Documento ${originalFileName} adicionado ao envelope ${envelopeId}.`,
    );

    return envelopeResponse.data.data;
  }

  async addSignerToEnvelope(
    envelopeId: string,
    signer: ClicksignSignerInput,
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/signers`;

    const signerPayload = {
      data: {
        type: 'signers',
        attributes: {
          ...signer,
          has_documentation: !!signer.documentation,
          communicate_events: {
            signature_request: 'whatsapp' as const,
            signature_reminder: 'email' as const,
            document_signed: 'whatsapp' as const,
          },
        },
      },
    };

    this.logger.log(
      `Adicionando signatário ${signer.email} ao envelope ${envelopeId}`,
    );
    const response = await firstValueFrom(
      this.httpService.post(url, signerPayload, { headers: this.getHeaders() }),
    );
    return response.data.data;
  }

  async notifyAllSigners(envelopeId: string): Promise<void> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/notifications`;
    const payload = {
      data: {
        type: 'notifications',
        attributes: {
          message: 'Você recebeu um documento para assinar.',
        },
      },
    };
    this.logger.log(
      `Enviando notificações para todos os signatários do envelope ${envelopeId}`,
    );
    await firstValueFrom(
      this.httpService.post(url, payload, { headers: this.getHeaders() }),
    );
  }

  /**
   * Consulta os metadados de um envelope existente na Clicksign (API v3).
   */
  async getEnvelope(envelopeId: string): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}`;
    this.logger.log(`Consultando status do envelope ${envelopeId}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.getHeaders() }),
      );
      return response.data;
    } catch (error) {
      const anyError = error as any;
      if (anyError.response?.status === 404) {
        this.logger.warn(`Envelope ${envelopeId} não encontrado na Clicksign.`);
        return null;
      }
      this.logger.error(
        `Falha ao consultar o envelope ${envelopeId}`,
        anyError.response?.data,
      );
      throw error;
    }
  }

  /**
   * Notifica um signatário específico de um envelope (API v3).
   * @param envelopeId - ID do envelope na Clicksign.
   * @param signerId - ID do signatário na Clicksign.
   * @param customMessage - Mensagem opcional a ser enviada.
   */
  async notifySigner(
    envelopeId: string,
    signerId: string,
    customMessage?: string,
  ): Promise<void> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/signers/${signerId}/notifications`;
    const message =
      customMessage ||
      'Lembrete: Você possui um documento pendente de assinatura.';

    const payload = {
      data: {
        type: 'notifications',
        attributes: {
          message: message,
        },
      },
    };

    this.logger.log(
      `Enviando notificação para o signatário ${signerId} do envelope ${envelopeId}`,
    );
    await firstValueFrom(
      this.httpService.post(url, payload, { headers: this.getHeaders() }),
    );
  }
}
