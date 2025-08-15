import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StorageService } from 'src/storage/storage.service';

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
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
  /**
   * Consulta os metadados de um documento existente na Clicksign.
   */
  async getDocument(documentKey: string): Promise<any> {
    const url = `${this.apiUrl}/api/v1/documents/${documentKey}?access_token=${this.accessToken}`;
    this.logger.log(`Consultando status do documento ${documentKey}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { headers: this.getHeaders() }),
      );
      this.logger.log(`GET DOCUMENT`, response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(
        `Falha ao consultar o documento ${documentKey}`,
        error.response?.data,
      );
      throw error;
    }
  }

  async createDocument(
    filePath: string,
    originalFileName: string,
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v1/documents?access_token=${this.accessToken}`;
    const { buffer: fileBuffer } =
      await this.storageService.getFileBuffer(filePath);
    const fileBase64 = fileBuffer.toString('base64');
    const documentData = {
      document: {
        path: `/${originalFileName}`,
        content_base64: `data:application/pdf;base64,${fileBase64}`,
        auto_close: true,
        locale: 'pt-BR',
        sequence_enabled: true,
        remind_interval: 14,
      },
    };
    return (
      await firstValueFrom(
        this.httpService.post(url, documentData, {
          headers: this.getHeaders(),
        }),
      )
    ).data;
  }

  async createSigner(signer: {
    email: string;
    name: string;
    phone?: string | null;
  }): Promise<any> {
    const url = `${this.apiUrl}/api/v1/signers?access_token=${this.accessToken}`;

    const signerData = {
      signer: {
        email: signer.email,
        name: signer.name,
        auths: ['whatsapp'],
        phone_number: signer.phone,
      },
    };
    return (
      await firstValueFrom(
        this.httpService.post(url, signerData, { headers: this.getHeaders() }),
      )
    ).data;
  }

  async addSignerToDocumentList(
    documentKey: string,
    signerKey: string,
    signAs: 'lessor' | 'lessee' | 'witness',
    message: string,
    group: number,
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v1/lists?access_token=${this.accessToken}`;

    const listData = {
      list: {
        document_key: documentKey,
        signer_key: signerKey,
        sign_as: signAs,
        message: message,
        group: group,
      },
    };

    this.logger.log(
      `Vinculando documento ${documentKey} ao signatário ${signerKey} como ${signAs}`,
    );
    return (
      await firstValueFrom(
        this.httpService.post(url, listData, { headers: this.getHeaders() }),
      )
    ).data;
  }

  /**
   * Reenvia a notificação de assinatura por e-mail.
   */
  async notifyByEmail(requestSignatureKey: string): Promise<any> {
    const url = `${this.apiUrl}/api/v1/notifications?access_token=${this.accessToken}`;
    const payload = {
      request_signature_key: requestSignatureKey,
      message:
        'Lembrete: O seu contrato de aluguel está aguardando a sua assinatura. Por favor, acesse o link enviado para concluir o processo.',
    };
    this.logger.log(
      `Enviando notificação por E-MAIL para a chave ${requestSignatureKey}`,
    );
    return (
      await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      )
    ).data;
  }

  /**
   * Reenvia a notificação de assinatura por WhatsApp.
   */
  async notifyByWhatsapp(requestSignatureKey: string): Promise<any> {
    const url = `${this.apiUrl}/api/v1/notify_by_whatsapp?access_token=${this.accessToken}`;
    const payload = {
      request_signature_key: requestSignatureKey,
    };
    this.logger.log(
      `Enviando notificação por WHATSAPP para a chave ${requestSignatureKey}`,
    );
    return (
      await firstValueFrom(
        this.httpService.post(url, payload, { headers: this.getHeaders() }),
      )
    ).data;
  }
}
