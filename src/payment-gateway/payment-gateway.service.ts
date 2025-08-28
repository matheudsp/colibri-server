import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type {
  CreateAsaasChargeDto,
  CreateAsaasCustomerDto,
  CreateAsaasSubAccountDto,
  CreateAsaasSubAccountResponse,
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

  async getCustomerDetails(
    apiKey: string = this.asaasApiKey,
    asaasCustomerId: string,
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/customers/${asaasCustomerId}`;
    try {
      this.logger.log(`Recuperar cliente: ${asaasCustomerId}`);

      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );

      this.logger.log(
        `Cliente recuperada com sucesso. Asaas Account ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao recuperar cliente no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento.',
      );
    }
  }

  async getSubAccountDetails(asaasSubAccountId: string): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/accounts/${asaasSubAccountId}`;
    try {
      this.logger.log(`Recuperar subconta: ${asaasSubAccountId}`);

      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            access_token: this.asaasApiKey,
          },
        }),
      );

      this.logger.log(
        `Subconta recuperada com sucesso. Asaas Account ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao recuperar subconta no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento.',
      );
    }
  }

  /**
   * Cria uma nova subconta White Label no Asaas.
   * @param accountData - Os dados do LOCADOR para criar a conta.
   * @returns O objeto da conta criada no Asaas.
   */
  async createWhitelabelSubAccount(
    accountData: CreateAsaasSubAccountDto,
  ): Promise<CreateAsaasSubAccountResponse> {
    const endpoint = `${this.asaasApiUrl}/accounts`;
    const authToken = crypto.randomUUID();
    const payload = {
      ...accountData,
      webhooks: [
        {
          name: `Webhook Padrão Colibri`,
          url: `${this.configService.get('API_URL')}/api/v1/webhooks/asaas`,
          email: 'atendimentoaocliente.valedosol@gmail.com',
          sendType: 'SEQUENTIALLY',
          enabled: true,
          apiVersion: 3,
          interrupted: false,
          authToken: authToken,
          events: [
            'PAYMENT_CONFIRMED', // Pagamento confirmado (ainda não creditado)
            'PAYMENT_OVERDUE',
            'PAYMENT_RECEIVED', // Pagamento recebido (creditado na conta)
            // 'PAYMENT_CREATED',
            // 'PAYMENT_UPDATED',
            // 'PAYMENT_DELETED',
            // 'PAYMENT_REFUNDED',
          ],
        },
      ],
    };

    try {
      // this.logger.log(`Criando subconta para: ${accountData.email}`);
      // this.logger.debug(
      //   'Enviando o seguinte payload para o Asaas:',
      //   JSON.stringify(payload, null, 2),
      // );
      // this.logger.log(`API ASAAS KEY: ${this.asaasApiKey}`);
      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            access_token: this.asaasApiKey,
          },
        }),
      );

      // this.logger.log(
      //   `Subconta criada com sucesso. Asaas Account ID: ${response.data.id}`,
      // );
      return { ...response.data, authTokenSent: authToken };
    } catch (error) {
      this.logger.error(
        'Falha ao criar subconta no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento.',
      );
    }
  }

  async getBalance(apiKey: string): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/finance/balance`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao consultar saldo', error.response?.data);
      throw new BadRequestException(
        error.response?.data || 'Erro no serviço de pagamentos',
      );
    }
  }

  async createCustomer(
    apiKey: string = this.asaasApiKey,
    customerData: CreateAsaasCustomerDto,
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/customers`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, customerData, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );
      this.logger.log(
        `Cliente criado com sucesso. Asaas Customer ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao criar cliente', error.response?.data);
      throw new BadRequestException(
        error.response?.data || 'Erro no serviço de pagamentos',
      );
    }
  }

  async createChargeWithSplitOnSubAccount(
    apiKey: string,
    chargeData: CreateAsaasChargeDto,
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/payments`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, chargeData, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao criar cobrança', error.response?.data);
      throw new BadRequestException(
        error.response?.data.description || 'Erro no serviço de pagamentos',
      );
    }
  }

  async deleteSubAccount(
    apiKey: string,
    asaasSubAccountId: string,
  ): Promise<any> {
    const removeReason = `Conta excluída da plataforma`;
    const endpoint = `${this.asaasApiUrl}/myAccount/?${removeReason}`;
    try {
      this.logger.log(`Remover subconta: ${asaasSubAccountId}`);

      const response = await firstValueFrom(
        this.httpService.delete(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );

      this.logger.log(
        `Subconta removida com sucesso. Asaas Account ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao remover subconta no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento.',
      );
    }
  }
}
