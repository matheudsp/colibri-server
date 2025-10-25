import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError, delay, retry } from 'rxjs/operators';
import {
  CreateAsaasChargeDto,
  CreateAsaasCustomerDto,
  CreateAsaasPixTransferDto,
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
  CreateAsaasTransferDto,
} from 'src/common/interfaces/payment-gateway.interface';
import * as crypto from 'crypto';
import FormData from 'form-data';
import type { UpdateCommercialInfoDto } from 'src/modules/subaccounts/dto/update-commercial-info.dto';
import type { CompanyType } from '@prisma/client';
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly asaasApiKey: string;
  private readonly asaasApiUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.asaasApiKey = this.configService.getOrThrow<string>('ASAAS_API_KEY');
    this.asaasApiUrl = this.configService.getOrThrow<string>('ASAAS_API_URL');
  }

  private async request<T = any>(
    method: 'get' | 'post' | 'delete',
    endpoint: string,
    apiKey: string = this.asaasApiKey,
    data?: any,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .request<T>({
            method,
            url: endpoint,
            data,
            headers: {
              'Content-Type': 'application/json',
              access_token: apiKey,
            },
          })
          .pipe(
            retry({
              count: 3,
              delay: (error, retryCount) => {
                this.logger.warn(
                  `Tentativa ${retryCount} falhou para ${endpoint}. Retentando...`,
                  error.message,
                );
                return throwError(() => error).pipe(
                  delay(1000 * Math.pow(2, retryCount - 1)),
                );
              },
            }),
          ),
      );
      return response.data;
    } catch (error) {
      this.handleError(
        error,
        `Erro ao chamar ${endpoint} após múltiplas tentativas`,
      );
    }
  }

  private handleError(error: any, defaultMessage: string): never {
    this.logger.error(defaultMessage, error.response?.data || error.message);

    if (error.code === 'ECONNABORTED') {
      throw new GatewayTimeoutException(
        'A comunicação com o gateway de pagamentos excedeu o tempo limite. Por favor, tente novamente em alguns instantes.',
      );
    }

    if (
      error.response?.data?.errors &&
      Array.isArray(error.response.data.errors) &&
      error.response.data.errors.length > 0
    ) {
      const firstError = error.response.data.errors[0];
      const errorMessage =
        firstError.description ||
        'Ocorreu um erro ao processar sua solicitação com o gateway de pagamento.';

      throw new BadRequestException(errorMessage);
    }

    throw new InternalServerErrorException(defaultMessage);
  }

  async getCustomerDetails(
    asaasCustomerId: string,
    apiKey: string = this.asaasApiKey,
  ) {
    const endpoint = `${this.asaasApiUrl}/customers/${asaasCustomerId}`;
    this.logger.log(`Recuperar cliente: ${asaasCustomerId}`);
    return this.request('get', endpoint, apiKey);
  }

  async getSubAccountDetails(asaasSubAccountId: string) {
    const endpoint = `${this.asaasApiUrl}/accounts/${asaasSubAccountId}`;
    this.logger.log(`Recuperar subconta: ${asaasSubAccountId}`);
    return this.request('get', endpoint);
  }

  async createWhitelabelSubAccount(
    accountData: CreateAsaasSubAccountDto,
  ): Promise<CreateAsaasSubAccountResponse> {
    const endpoint = `${this.asaasApiUrl}/accounts`;
    const authToken = crypto.randomUUID();

    const payload: Record<string, any> = {
      ...accountData,
      webhooks: [
        {
          name: 'Webhook Padrão Locaterra',
          url: `${this.configService.get('API_URL')}/api/v1/webhooks/asaas`,
          email: 'atendimentoaocliente.locaterra@gmail.com',
          sendType: 'SEQUENTIALLY',
          enabled: true,
          apiVersion: 3,
          interrupted: false,
          authToken,
          events: [
            'PAYMENT_CREATED',
            'PAYMENT_UPDATED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_OVERDUE',
            'PAYMENT_RECEIVED',
            'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
            'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
            'ACCOUNT_STATUS_DOCUMENT_REJECTED',
            'TRANSFER_DONE',
            'TRANSFER_FAILED',
            'TRANSFER_CANCELLED',
          ],
        },
      ],
    };

    const response = await this.request(
      'post',
      endpoint,
      this.asaasApiKey,
      payload,
    );
    return { ...response, authTokenSent: authToken };
  }

  async getBalance(apiKey: string) {
    return this.request('get', `${this.asaasApiUrl}/finance/balance`, apiKey);
  }

  async confirmCashPayment(
    chargeId: string,
    paymentDate: Date,
    value: number,
    apiKey: string,
  ) {
    const endpoint = `${this.asaasApiUrl}/payments/${chargeId}/receiveInCash`;
    this.logger.log(
      `Confirmando recebimento em dinheiro para a cobrança: ${chargeId}`,
    );
    return this.request('post', endpoint, apiKey, {
      paymentDate: paymentDate.toISOString().split('T')[0],
      value,
      notifyCustomer: true,
    });
  }

  async createCustomer(
    apiKey: string = this.asaasApiKey,
    customerData: CreateAsaasCustomerDto,
  ) {
    const endpoint = `${this.asaasApiUrl}/customers`;
    this.logger.log(`Criando cliente: ${customerData.name}`);
    return this.request('post', endpoint, apiKey, customerData);
  }

  async createChargeWithSplitOnSubAccount(
    apiKey: string,
    chargeData: CreateAsaasChargeDto,
  ) {
    return this.request(
      'post',
      `${this.asaasApiUrl}/payments`,
      apiKey,
      chargeData,
    );
  }

  async deleteSubAccount(apiKey: string, asaasSubAccountId: string) {
    const removeReason = `Conta excluída da plataforma`;
    const endpoint = `${this.asaasApiUrl}/myAccount/?${removeReason}`;
    this.logger.log(`Remover subconta: ${asaasSubAccountId}`);
    return this.request('delete', endpoint, apiKey);
  }

  async cancelCharge(apiKey: string, chargeId: string) {
    const endpoint = `${this.asaasApiUrl}/payments/${chargeId}`;
    this.logger.log(`Solicitando cancelamento para a cobrança: ${chargeId}`);
    return this.request('delete', endpoint, apiKey);
  }

  async createPixTransfer(
    apiKey: string,
    transferData: CreateAsaasPixTransferDto,
  ) {
    const payload = {
      operationType: 'PIX',
      value: transferData.value,
      pixAddressKey: transferData.pixAddressKey,
      pixAddressKeyType: transferData.pixAddressKeyType,
      description: transferData.description,
    };
    this.logger.log(
      `Solicitando PIX para chave: ${transferData.pixAddressKey}`,
    );
    return this.request(
      'post',
      `${this.asaasApiUrl}/transfers`,
      apiKey,
      payload,
    );
  }

  async createTransfer(apiKey: string, transferData: CreateAsaasTransferDto) {
    this.logger.log(
      `Solicitando transferência bancária para conta: ${transferData.bankAccount.account}`,
    );
    return this.request(
      'post',
      `${this.asaasApiUrl}/transfers`,
      apiKey,
      transferData,
    );
  }

  async getRequiredDocuments(apiKey: string) {
    this.logger.log(`Buscando documentos necessários para a conta...`);
    return this.request(
      'get',
      `${this.asaasApiUrl}/myAccount/documents`,
      apiKey,
    );
  }

  /**
   * Envia um arquivo de documento para um grupo de documentos específico da subconta.
   * @param apiKey - A chave da API da subconta.
   * @param documentGroupId - O ID do grupo de documentos (ex: "38aeb2d1-c646-4aee-999a-2c56dc68abbe").
   * @param documentType - O tipo do documento (ex: "SOCIAL_CONTRACT").
   * @param file - O arquivo a ser enviado.
   */
  async uploadDocumentForSubAccount(
    apiKey: string,
    documentGroupId: string,
    documentType: string,
    file: Express.Multer.File,
  ) {
    const endpoint = `${this.asaasApiUrl}/myAccount/documents/${documentGroupId}`;
    this.logger.log(
      `Enviando documento do tipo '${documentType}' para o grupo: ${documentGroupId}`,
    );

    const form = new FormData();

    form.append('type', documentType);

    form.append('documentFile', file.buffer, file.originalname);

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, form, {
          headers: {
            ...(form as any).getHeaders(),
            access_token: apiKey,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.handleError(
        error,
        `Erro ao enviar documento para o grupo ${documentGroupId}`,
      );
    }
  }

  async getPixKeyById(apiKey: string, keyId: string): Promise<any> {
    this.logger.log(`Buscando chave PIX por ID: ${keyId}`);
    return this.request<any>(
      'get',
      `${this.asaasApiUrl}/pix/addressKeys/${keyId}`,
      apiKey,
    );
  }

  /**
   * Cria uma nova chave PIX do tipo EVP para a subconta no Asaas.
   * @returns O objeto da nova chave PIX criada.
   */
  async createEvpPixKey(apiKey: string): Promise<any> {
    this.logger.log('Criando nova chave PIX EVP na Asaas...');
    const response = await this.request<any>(
      'post',
      `${this.asaasApiUrl}/pix/addressKeys`,
      apiKey,
      { type: 'EVP' },
    );
    this.logger.log(`Chave PIX EVP criada com sucesso: ${response.id}`);
    return response;
  }

  /**
   * Busca uma chave PIX EVP ativa listando todas as chaves da subconta.
   * @returns O objeto da chave PIX se encontrado, caso contrário null.
   */
  async findActiveEvpPixKey(apiKey: string): Promise<any | null> {
    this.logger.log('Buscando por chave PIX EVP ativa na Asaas...');
    const response = await this.request<any>(
      'get',
      `${this.asaasApiUrl}/pix/addressKeys`,
      apiKey,
    );

    if (response && Array.isArray(response.data)) {
      const evpKey = response.data.find(
        (key: any) => key.type === 'EVP' && key.status === 'ACTIVE',
      );
      if (evpKey) {
        this.logger.log(`Chave PIX EVP ativa encontrada: ${evpKey.id}`);
        return evpKey;
      }
    }

    this.logger.log('Nenhuma chave PIX EVP ativa encontrada.');
    return null;
  }

  /**
   * Obtém os dados do QR Code PIX para uma cobrança existente.
   * @param apiKey Chave de API da subconta.
   * @param chargeId Identificador único da cobrança no Asaas.
   * @returns Objeto com a imagem em base64 e o payload (copia e cola).
   */
  async getPixQrCode(apiKey: string, chargeId: string): Promise<any> {
    this.logger.log(`Obtendo QR Code PIX para a cobrança: ${chargeId}`);
    const endpoint = `${this.asaasApiUrl}/payments/${chargeId}/pixQrCode`;
    return this.request<any>('get', endpoint, apiKey);
  }

  /**
   * Obtém a linha digitável (identification field) de um boleto existente.
   * @param apiKey Chave de API da subconta.
   * @param chargeId Identificador único da cobrança no Asaas.
   * @returns Objeto com a linha digitável.
   */
  async getBankSlipIdentificationField(
    apiKey: string,
    chargeId: string,
  ): Promise<any> {
    this.logger.log(`Obtendo linha digitável para a cobrança: ${chargeId}`);
    const endpoint = `${this.asaasApiUrl}/payments/${chargeId}/identificationField`;
    return this.request<any>('get', endpoint, apiKey);
  }

  async updateCommercialInfo(
    apiKey: string,
    data: UpdateCommercialInfoDto,
    originalUserData: {
      cpfCnpj: string;
      birthDate?: Date | null;
      companyType?: CompanyType | null;
    },
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/myAccount/commercialInfo`;
    this.logger.log(`Atualizando informações comerciais...`);

    const isPJ = originalUserData.cpfCnpj.length > 11;
    const payload = {
      ...data,
      personType: isPJ ? 'JURIDICA' : 'FISICA',
      cpfCnpj: originalUserData.cpfCnpj,

      ...(isPJ
        ? { companyType: originalUserData.companyType }
        : {
            birthDate: originalUserData.birthDate?.toISOString().split('T')[0],
          }),

      ...(isPJ && { companyName: data.companyName || 'Nome não fornecido' }),
    };

    if (payload.phone === undefined) delete payload.phone;
    if (payload.site === undefined) delete payload.site;
    if (payload.complement === undefined) delete payload.complement;
    if (!isPJ && payload.companyName) delete payload.companyName;
    return this.request('post', endpoint, apiKey, payload);
  }
}
