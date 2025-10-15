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
    return {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Authorization: this.accessToken,
    };
  }

  async createEnvelope(contractId: string): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes`;
    const payload = {
      data: {
        type: 'envelopes',
        attributes: {
          name: `Contrato de Locação - ${contractId}`,
          remind_interval: 14,
          locale: 'pt-BR',
          auto_close: true,
          default_subject: 'Quase lá, falta pouco para iniciar sua locação!',
          default_message:
            'Por favor, assine o documento abaixo digitalmente para prosseguir.',
        },
      },
    };
    this.logger.log('PASSO 1: Criando Envelope');
    const response = await firstValueFrom(
      this.httpService.post(url, payload, { headers: this.getHeaders() }),
    );
    return response.data.data;
  }

  async addDocumentToEnvelope(
    envelopeId: string,
    filePath: string,
    originalFileName: string,
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/documents`;
    const { buffer: fileBuffer } =
      await this.storageService.getFileBuffer(filePath);
    const fileBase64 = fileBuffer.toString('base64');
    const payload = {
      data: {
        type: 'documents',
        attributes: {
          filename: originalFileName,
          content_base64: `data:application/pdf;base64,${fileBase64}`,
        },
      },
    };
    this.logger.log(`PASSO 2: Adicionando Documento ao Envelope ${envelopeId}`);
    const response = await firstValueFrom(
      this.httpService.post(url, payload, { headers: this.getHeaders() }),
    );
    return response.data.data;
  }

  async addSignerToEnvelope(
    envelopeId: string,
    signer: ClicksignSignerInput,
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/signers`;
    const payload = {
      data: {
        type: 'signers',
        attributes: {
          ...signer,
          has_documentation: !!signer.documentation,
          communicate_events: {
            // signature_request: 'whatsapp',
            signature_request: 'email',
            signature_reminder: 'email',
            // document_signed: 'whatsapp',
            document_signed: 'email',
          },
        },
      },
    };
    this.logger.log(
      `PASSO 3: Adicionando Signatário ${signer.email} ao Envelope ${envelopeId}`,
    );
    const response = await firstValueFrom(
      this.httpService.post(url, payload, { headers: this.getHeaders() }),
    );
    return response.data.data;
  }
  async addRequirementsToSigner(
    envelopeId: string,
    documentId: string,
    signerId: string,
    role: 'lessor' | 'lessee',
  ): Promise<void> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/requirements`;
    const commonRelationships = {
      document: { data: { type: 'documents', id: documentId } },
      signer: { data: { type: 'signers', id: signerId } },
    };

    // Requisito 1: Qualificação (Papel)
    const qualificationPayload = {
      data: {
        type: 'requirements',
        attributes: { action: 'agree', role },
        relationships: commonRelationships,
      },
    };
    this.logger.log(
      `PASSO 4a: Adicionando Requisito de QUALIFICAÇÃO ('${role}') para o signatário ${signerId}.`,
    );
    await firstValueFrom(
      this.httpService.post(url, qualificationPayload, {
        headers: this.getHeaders(),
      }),
    );

    // Requisito 2: Autenticação
    const authenticationPayload = {
      data: {
        type: 'requirements',
        attributes: {
          action: 'provide_evidence',
          // auth: 'selfie' as const, // em produção usar 'selfie' para segurança
          // auth: 'whatsapp' as const, // em testes usar 'whatsapp' para evitar dor de cabeça
          auth: 'email' as const, // em testes usar 'email' para evitar dor de cabeça
        },
        relationships: commonRelationships,
      },
    };
    this.logger.log(
      `PASSO 4b: Adicionando Requisito de AUTENTICAÇÃO para o signatário ${signerId}.`,
    );
    await firstValueFrom(
      this.httpService.post(url, authenticationPayload, {
        headers: this.getHeaders(),
      }),
    );
  }

  async notifyAllSigners(envelopeId: string): Promise<void> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}/notifications`;
    const payload = {
      data: {
        type: 'notifications',
        attributes: { message: 'Você recebeu um documento para assinar.' },
      },
    };
    this.logger.log(`Enviando notificações para o envelope ${envelopeId}`);
    try {
      await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      );
    } catch (error) {
      this.logger.error(
        `ERRO AO NOTIFICAR SIGNATÁRIOS (STATUS ${error.response?.status})`,
      );
      this.logger.error(
        'RESPOSTA DE ERRO DA CLICKSIGN:',
        JSON.stringify(error.response?.data, null, 2),
      );
      throw error;
    }
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

  async deleteEnvelope(envelopeId: string): Promise<any> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}`;
    this.logger.log(`Excluindo envelope ${envelopeId}`);
    try {
      await firstValueFrom(
        this.httpService.delete(url, { headers: this.getHeaders() }),
      );
    } catch (error) {
      const anyError = error as any;
      if (anyError.response?.status === 404) {
        this.logger.warn(`Envelope ${envelopeId} não encontrado na Clicksign.`);
        return null;
      }
      this.logger.error(
        `Falha ao deletar o envelope ${envelopeId}`,
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

  async activateEnvelope(envelopeId: string): Promise<void> {
    const url = `${this.apiUrl}/api/v3/envelopes/${envelopeId}`;
    const payload = {
      data: {
        type: 'envelopes',
        id: envelopeId,
        attributes: { status: 'running' },
      },
    };
    this.logger.log(`PASSO 5: Ativando Envelope ${envelopeId}...`);
    await firstValueFrom(
      this.httpService.patch(url, payload, { headers: this.getHeaders() }),
    );
  }
}
