import { ConfigService } from '@nestjs/config';
import { AsaasCustomersService } from '../asaas-customers/asaas-customers.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DateUtils } from 'src/common/utils/date.utils';
import { PaymentStatus, type Prisma } from '@prisma/client';
import { differenceInDays } from 'date-fns';

@Injectable()
export class ChargesService {
  private readonly platformWalletId: string;
  private readonly logger = new Logger(ChargesService.name);
  constructor(
    private prisma: PrismaService,
    private paymentGateway: PaymentGatewayService,
    private asaasCustomerService: AsaasCustomersService,
    private configService: ConfigService,
  ) {
    this.platformWalletId = this.configService.getOrThrow('ASSAS_WALLET_ID');
  }
  private async getOrCreateEvpPixKey(subAccount: {
    id: string;
    apiKey: string;
    asaasPixKeyId: string | null;
  }): Promise<string> {
    if (subAccount.asaasPixKeyId) {
      try {
        const keyDetails = await this.paymentGateway.getPixKeyById(
          subAccount.apiKey,
          subAccount.asaasPixKeyId,
        );
        if (keyDetails && keyDetails.status === 'ACTIVE') {
          this.logger.log(
            `Chave PIX ${keyDetails.id} recuperada do DB e validada.`,
          );
          return keyDetails.id;
        }
      } catch (error) {
        this.logger.warn(
          `Chave PIX ${subAccount.asaasPixKeyId} do DB é inválida ou foi removida. Buscando alternativa.`,
        );
      }
    }

    let existingKey = await this.paymentGateway.findActiveEvpPixKey(
      subAccount.apiKey,
    );

    if (!existingKey) {
      existingKey = await this.paymentGateway.createEvpPixKey(
        subAccount.apiKey,
      );
    }

    if (existingKey && existingKey.id !== subAccount.asaasPixKeyId) {
      await this.prisma.subAccount.update({
        where: { id: subAccount.id },
        data: { asaasPixKeyId: existingKey.id },
      });
      this.logger.log(
        `ID da chave PIX ${existingKey.id} salvo para a subconta ${subAccount.id}.`,
      );
    }

    if (!existingKey?.id) {
      throw new InternalServerErrorException(
        'Não foi possível obter ou criar uma chave PIX EVP.',
      );
    }

    return existingKey.id;
  }

  /**
   * Gera uma cobrança para uma ordem de pagamento PENDENTE.
   **/
  async generateChargeForPaymentOrder(
    paymentOrderId: string,
    billingType: 'BOLETO' | 'PIX' | 'UNDEFINED',
  ) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        charge: true,
        contract: {
          include: {
            tenant: true,
            landlord: { include: { bankAccount: true, subAccount: true } },
            property: true,
          },
        },
      },
    });

    if (!paymentOrder)
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    if (paymentOrder.charge)
      throw new ConflictException('Já existe uma cobrança para essa fatura.');
    if (paymentOrder.status === PaymentStatus.ATRASADO) {
      throw new BadRequestException(
        'Esta fatura está vencida. Por favor, solicite a emissão de uma novo cobranças cobrança.',
      );
    }

    if (paymentOrder.isSecurityDeposit) {
      // Se for a fatura da caução, só pode gerar se o contrato estiver AGUARDANDO_GARANTIA
      if (paymentOrder.contract.status !== 'AGUARDANDO_GARANTIA') {
        throw new BadRequestException(
          'A cobrança da caução só pode ser gerada enquanto o contrato aguarda o pagamento da garantia.',
        );
      }
    } else {
      // Para todas as outras faturas (aluguel), o contrato DEVE estar ATIVO
      if (paymentOrder.contract.status !== 'ATIVO') {
        throw new BadRequestException(
          'Cobranças de aluguel só podem ser geradas para contratos ativos.',
        );
      }
    }

    const { contract } = paymentOrder;
    const landlord = contract.landlord;

    if (!landlord.subAccount?.apiKey || !landlord.subAccount?.asaasWalletId)
      throw new BadRequestException(
        'A conta do locador não está configurada para recebimentos. Entre em contato com suporte.',
      );

    if (billingType === 'PIX') {
      await this.getOrCreateEvpPixKey({
        id: landlord.subAccount.id,
        apiKey: landlord.subAccount.apiKey,
        asaasPixKeyId: landlord.subAccount.asaasPixKeyId,
      });
    }
    const customerId = await this.asaasCustomerService.getOrCreate(
      contract.tenant.id,
      landlord.subAccount.id,
    );

    const value = paymentOrder.isSecurityDeposit
      ? (contract.securityDeposit?.toNumber() ?? 0)
      : contract.rentAmount.toNumber() +
        (contract.condoFee?.toNumber() ?? 0) +
        (contract.iptuFee?.toNumber() ?? 0);

    const dueDate = paymentOrder.dueDate.toISOString().split('T')[0];
    if (new Date(dueDate) < new Date(new Date().toISOString().split('T')[0])) {
      throw new BadRequestException(
        'Não é permitido gerar uma cobrança com data de vencimento no passado.',
      );
    }
    const dueDateObj = new Date(paymentOrder.dueDate);
    const referenceMonth = (dueDateObj.getUTCMonth() + 1)
      .toString()
      .padStart(2, '0');
    const referenceYear = dueDateObj.getUTCFullYear();
    const platformFee =
      landlord.subAccount.platformFeePercentage?.toNumber() || 5; // Usa 5% como padrão
    const description = paymentOrder.isSecurityDeposit
      ? `Pagamento da Garantia (Depósito Caução) referente ao contrato do imóvel "${contract.property.title}".`
      : `Aluguel referente a ${referenceMonth}/${referenceYear} do imóvel "${contract.property.title}". Inquilino: ${contract.tenant.name}.`;
    const chargePayload = {
      customer: customerId,
      billingType,
      dueDate,
      value,
      description: description,
      split: [
        { walletId: this.platformWalletId, percentualValue: platformFee },
      ],
      daysAfterDueDateToRegistrationCancellation: 60,
      fine: { value: 2, type: 'PERCENTAGE' as const },
      interest: { value: 1 },
    };
    const chargeResponse =
      await this.paymentGateway.createChargeWithSplitOnSubAccount(
        landlord.subAccount.apiKey,
        chargePayload,
      );
    const chargeData: Prisma.ChargeCreateInput = {
      paymentOrder: { connect: { id: paymentOrder.id } },
      asaasChargeId: chargeResponse.id,
      invoiceUrl: chargeResponse.invoiceUrl,
      dueDate: paymentOrder.dueDate,
      bankSlipUrl: chargeResponse.bankSlipUrl,
      nossoNumero: chargeResponse.nossoNumero,
    };

    return this.prisma.charge.create({
      data: chargeData,
    });
  }

  /**
   * Obtém os dados do QR Code PIX diretamente do gateway de pagamento.
   */
  async getPixQrCodeForCharge(paymentOrderId: string) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        charge: true,
        contract: { include: { landlord: { include: { subAccount: true } } } },
      },
    });

    if (!paymentOrder?.charge) {
      throw new BadRequestException(
        'Esta fatura ainda não possui uma cobrança gerada.',
      );
    }

    const landlordApiKey = paymentOrder.contract.landlord.subAccount?.apiKey;
    if (!landlordApiKey) {
      throw new BadRequestException(
        'A conta do locador não está configurada para recebimentos.',
      );
    }

    this.logger.log(
      `Buscando dados de PIX na Asaas para a cobrança ${paymentOrder.charge.asaasChargeId}.`,
    );

    return this.paymentGateway.getPixQrCode(
      landlordApiKey,
      paymentOrder.charge.asaasChargeId,
    );
  }

  /**
   * Obtém a linha digitável de um boleto de uma cobrança existente.
   */
  async getBankSlipIdentificationField(paymentOrderId: string) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        charge: true,
        contract: {
          include: {
            landlord: { include: { subAccount: true } },
          },
        },
      },
    });

    if (!paymentOrder) {
      throw new NotFoundException('Ordem de pagamento não encontrada.');
    }
    if (!paymentOrder.charge) {
      throw new BadRequestException(
        'Esta fatura ainda não possui uma cobrança gerada.',
      );
    }
    if (!paymentOrder.charge.bankSlipUrl) {
      throw new BadRequestException('Esta cobrança não é um boleto.');
    }

    const landlordApiKey = paymentOrder.contract.landlord.subAccount?.apiKey;
    if (!landlordApiKey) {
      throw new BadRequestException(
        'A conta do locador não está configurada para recebimentos.',
      );
    }

    // Chama o gateway para obter os dados da linha digitável
    const identificationFieldData =
      await this.paymentGateway.getBankSlipIdentificationField(
        landlordApiKey,
        paymentOrder.charge.asaasChargeId,
      );

    // Opcional: Salvar a linha digitável no banco de dados se houver um campo para isso.
    // await this.prisma.charge.update({
    //   where: { id: paymentOrder.charge.id },
    //   data: { identificationField: identificationFieldData.identificationField },
    // });

    return identificationFieldData;
  }
}
