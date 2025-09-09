import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  CreateAsaasChargeDto,
  CreateAsaasCustomerDto,
  CreateAsaasPixTransferDto,
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
  CreateAsaasTransferDto,
} from 'src/common/interfaces/payment-gateway.interface';
import * as crypto from 'crypto';

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

  /**
   * ---------- MÉTODOS GENÉRICOS ----------
   */
  private async request<T = any>(
    method: 'get' | 'post' | 'delete',
    endpoint: string,
    apiKey: string = this.asaasApiKey,
    data?: any,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: endpoint,
          data,
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.handleError(error, `Erro ao chamar ${endpoint}`);
    }
  }

  private handleError(error: any, defaultMessage: string): never {
    this.logger.error(defaultMessage, error.response?.data);
    if (error.response?.data) {
      throw new BadRequestException(error.response.data);
    }
    throw new InternalServerErrorException(defaultMessage);
  }

  /**
   * ---------- MÉTODOS DE NEGÓCIO ----------
   */
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
          name: 'Webhook Padrão Colibri',
          url: `${this.configService.get('API_URL')}/api/v1/webhooks/asaas`,
          email: 'atendimentoaocliente.valedosol@gmail.com',
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
}
