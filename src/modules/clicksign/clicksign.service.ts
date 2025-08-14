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
   * Etapa 1: Envia o documento para a Clicksign.
   */
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

  /**
   * Etapa 2: Cria um signatário na plataforma.
   */
  async createSigner(signer: { email: string; name: string }): Promise<any> {
    const url = `${this.apiUrl}/api/v1/signers?access_token=${this.accessToken}`;
    const signerData = {
      signer: { email: signer.email, name: signer.name, auths: ['email'] },
    };
    return (
      await firstValueFrom(
        this.httpService.post(url, signerData, { headers: this.getHeaders() }),
      )
    ).data;
  }

  /**
   * Etapa 3: Vincula um signatário a um documento para criar a solicitação de assinatura.
   */
  async addSignerToDocumentList(
    documentKey: string,
    signerKey: string,
    signAs: 'lessor' | 'lessee' | 'witness',
  ): Promise<any> {
    const url = `${this.apiUrl}/api/v1/lists?access_token=${this.accessToken}`;
    const listData = {
      list: {
        document_key: documentKey,
        signer_key: signerKey,
        sign_as: signAs,
        message: 'Por favor, assine o contrato de aluguel.',
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
}
