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
            'PAYMENT_CREATED',
            'PAYMENT_UPDATED',
            'PAYMENT_CONFIRMED', // Pagamento confirmado (ainda não creditado)
            'PAYMENT_OVERDUE', // Pagamento vencido
            'PAYMENT_RECEIVED', // Pagamento recebido (creditado na conta)
            // 'PAYMENT_DELETED',
            // 'PAYMENT_REFUNDED',

            'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
            'ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED',
            'ACCOUNT_STATUS_DOCUMENT_REJECTED',
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
  /**
   * Cria uma nova transferência exclusivamente via PIX.
   * @param apiKey - A chave de API da subconta Asaas do locador.
   * @param transferData - Os dados da transferência PIX.
   * @returns O objeto da transferência criada no Asaas.
   */
  async createPixTransfer(
    apiKey: string,
    transferData: CreateAsaasPixTransferDto,
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/transfers`;
    try {
      this.logger.log(
        `Iniciando solicitação de transferência PIX para a chave: ${transferData.pixAddressKey}`,
      );

      const payload = {
        operationType: 'PIX',
        value: transferData.value,
        pixAddressKey: transferData.pixAddressKey,
        pixAddressKeyType: transferData.pixAddressKeyType,
        description: transferData.description,
      };

      this.logger.debug(
        `[DEBUG] API Key utilizada para transferência: ${apiKey.substring(0, 15)}...`,
      );
      this.logger.debug(
        `[DEBUG] Payload enviado para Asaas /transfers: ${JSON.stringify(payload, null, 2)}`,
      );

      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );
      this.logger.log(
        `Transferência PIX criada com sucesso. Asaas Transfer ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao criar transferência PIX no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento para criar a transferência PIX.',
      );
    }
  }
  /**
   * Cria uma nova transferência para uma conta bancária.
   * @param apiKey - A chave de API da subconta Asaas do locador.
   * @param transferData - Os dados da transferência.
   * @returns O objeto da transferência criada no Asaas.
   */
  async createTransfer(
    apiKey: string,
    transferData: CreateAsaasTransferDto,
  ): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/transfers`;
    try {
      this.logger.log(
        `Iniciando solicitação de transferência para a conta: ${transferData.bankAccount.account}`,
      );
      const response = await firstValueFrom(
        this.httpService.post(endpoint, transferData, {
          headers: {
            'Content-Type': 'application/json',
            access_token: apiKey,
          },
        }),
      );
      this.logger.log(
        `Transferência criada com sucesso. Asaas Transfer ID: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao criar transferência no Asaas',
        error.response?.data,
      );
      if (error.response?.data) {
        throw new BadRequestException(error.response.data);
      }
      throw new InternalServerErrorException(
        'Ocorreu um erro ao se comunicar com o gateway de pagamento para criar a transferência.',
      );
    }
  }

  /**
   * Busca os documentos necessários e os links de onboarding.
   */
  async getRequiredDocuments(apiKey: string): Promise<any> {
    const endpoint = `${this.asaasApiUrl}/myAccount/documents`;
    try {
      this.logger.log(`Buscando documentos necessários para a conta...`);
      const response = await firstValueFrom(
        this.httpService.get(endpoint, {
          headers: { 'Content-Type': 'application/json', access_token: apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        'Falha ao buscar documentos no Asaas',
        error.response?.data,
      );
      throw new InternalServerErrorException(
        'Falha ao consultar a documentação necessária no gateway de pagamento.',
      );
    }
  }
}
