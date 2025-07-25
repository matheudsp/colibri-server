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

    const defaultWebhook = {
      name: `Webhook Test`,
      url: `${this.configService.get('APP_URL')}/webhooks/asaas`,
      email: this.configService.get('MAIL_FROM_ADDRESS'),
      sendType: 'SEQUENTIALLY',
      enabled: true,
      apiVersion: 3,
      interrupted: false,
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_UPDATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_DELETED',
      ],
    };

    try {
      this.logger.log(`Criando subconta para: ${accountData.email}`);

      const response = await firstValueFrom(
        this.httpService.post(
          endpoint,
          { ...accountData, webhooks: [defaultWebhook] },
          {
            headers: {
              'Content-Type': 'application/json',
              access_token: this.asaasApiKey,
            },
          },
        ),
      );

      this.logger.log(
        `Subconta criada com sucesso. Asaas Account ID: ${response.data.id}`,
      );
      return response.data;
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

  async createCustomer(customerData: CreateAsaasCustomerDto): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/customers`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, customerData, {
          headers: {
            'Content-Type': 'application/json',
            access_token: this.asaasApiKey,
          },
        }),
      );
      this.logger.log(
        `Cliente criado com sucesso. Asaas Customer ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Erro ao criar cliente', error.response?.data);
      throw new BadRequestException(error.response?.data || 'Erro no Asaas');
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
      throw new BadRequestException(error.response?.data || 'Erro no Asaas');
    }
  }
}
