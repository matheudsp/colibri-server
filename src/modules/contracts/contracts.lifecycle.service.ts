import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatus, GuaranteeType } from '@prisma/client';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { UserService } from '../users/users.service';
import { LogHelperService } from '../logs/log-helper.service';
import { ClicksignService } from '../clicksign/clicksign.service';
import { PdfsService } from '../pdfs/pdfs.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { ContractPaymentService } from './contracts.payment.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContractLifecycleService {
  private readonly logger = new Logger(ContractLifecycleService.name);
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PropertiesService))
    private propertiesService: PropertiesService,
    private userService: UserService,
    private logHelper: LogHelperService,
    private pdfsService: PdfsService,
    private paymentGateway: PaymentGatewayService,
    private contractPaymentService: ContractPaymentService,
    @Inject(forwardRef(() => PaymentsOrdersService))
    private paymentsOrdersService: PaymentsOrdersService,
    private notificationsService: NotificationsService,
    private clicksignService: ClicksignService,
  ) {}

  async create(
    createContractDto: CreateContractDto,
    currentUser: { sub: string; role: string },
  ) {
    if (currentUser.role !== ROLES.LOCADOR) {
      throw new UnauthorizedException(
        'Apenas locadores podem criar contratos.',
      );
    }

    const {
      propertyId,
      tenantEmail,
      tenantName,
      tenantCpfCnpj,
      tenantPassword,
      tenantPhone,
      ...contractData
    } = createContractDto;

    const property = await this.propertiesService.findOne(propertyId);
    if (property.landlordId !== currentUser.sub) {
      throw new UnauthorizedException(
        'Você não é o proprietário deste imóvel.',
      );
    }

    const tenant = await this.userService.findOrCreateTenant(
      {
        email: tenantEmail,
        name: tenantName,
        cpfCnpj: tenantCpfCnpj,
        password: tenantPassword,
        phone: tenantPhone,
      },
      ROLES.LOCATARIO,
    );

    const startDate = new Date(contractData.startDate);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Data de início do contrato inválida.');
    }
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + contractData.durationInMonths);

    const contract = await this.prisma.contract.create({
      data: {
        ...contractData,
        propertyId,
        landlordId: currentUser.sub,
        tenantId: tenant.id,
        startDate,
        endDate,
        status: ContractStatus.PENDENTE_DOCUMENTACAO,
      },
    });

    await this.logHelper.createLog(
      currentUser?.sub,
      'CREATE',
      'Contract',
      contract.id,
    );

    if (property && tenant) {
      await this.notificationsService.create({
        userId: tenant.id,
        user: { email: tenant.email, name: tenant.name },
        title: 'Seu contrato de aluguel foi criado!',
        message: `O proprietário do imóvel "${property.title}" iniciou um processo de locação com você. O próximo passo é enviar seus documentos para análise.`,
        action: {
          text: 'Acessar e Enviar Documentos',
          path: `/contratos/${contract.id}/documentos`,
        },
        sendEmail: true,
      });
    }

    return {
      ...contract,
      tenant: {
        name: tenant.name,
        phone: tenant.phone,
        cpfCnpj: tenant.cpfCnpj,
        email: tenant.email,
        password: tenantPassword,
      },
    };
  }

  async activateContractAfterSignature(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        landlord: { select: { id: true, name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (
      !contract ||
      contract.status !== ContractStatus.AGUARDANDO_ASSINATURAS
    ) {
      // Nenhuma ação se o contrato não existe ou já foi processado
      return;
    }

    if (
      contract.guaranteeType === GuaranteeType.DEPOSITO_CAUCAO &&
      contract.securityDeposit &&
      contract.securityDeposit?.toNumber() > 0
    ) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.AGUARDANDO_GARANTIA },
      });

      await this.paymentsOrdersService.createAndChargeSecurityDeposit(
        contractId,
      );
      this.logger.log(`Contrato ${contractId} aguardando pagamento da caução.`);
      await this.notificationsService.create({
        userId: contract.tenant.id,
        user: { name: contract.tenant.name, email: contract.tenant.email },
        title: 'Ação Necessária: Pagar Depósito Caução',
        message: `Seu contrato para o imóvel "${contract.property.title}" foi assinado! Para ativá-lo, o próximo passo é realizar o pagamento do depósito caução.`,
        action: {
          text: 'Pagar Depósito Caução',
          path: `/contratos/${contract.id}`,
        },
        sendEmail: true,
      });
    } else {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.ATIVO },
      });
      await this.prisma.property.update({
        where: { id: contract.propertyId },
        data: { isAvailable: false },
      });

      await this.contractPaymentService.createPaymentsAndFirstBankSlip(
        contractId,
      );
      const notification = {
        title: 'Contrato Assinado e Ativado!',
        message: `O contrato de aluguel para o imóvel "${contract.property.title}" foi assinado por todas as partes e agora está ativo.`,
      };

      const action = {
        text: 'Ver Contrato',
        path: `/contratos/${contract.id}`,
      };

      this.notificationsService.create({
        userId: contract.tenant.id,
        user: contract.tenant,
        title: notification.title,
        message: notification.message,
        action: action,
        sendEmail: true,
      });
      this.notificationsService.create({
        userId: contract.landlord.id,
        user: contract.landlord,
        title: notification.title,
        message: notification.message,
        action: action,
        sendEmail: true,
      });

      console.log(`Contrato ${contractId} ativado com sucesso via webhook.`);
    }
  }

  async activateContractAfterDepositPayment(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        landlord: { select: { id: true, name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (!contract || contract.status !== ContractStatus.AGUARDANDO_GARANTIA) {
      this.logger.warn(
        `Tentativa de ativar o contrato ${contractId} que não estava aguardando pagamento da caução.`,
      );
      return;
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ATIVO },
    });

    await this.prisma.property.update({
      where: { id: contract.propertyId },
      data: { isAvailable: false },
    });

    await this.contractPaymentService.createPaymentsAndFirstBankSlip(
      contractId,
    );

    this.logger.log(
      `Contrato ${contractId} ativado com sucesso após pagamento da caução.`,
    );
    const notification = {
      title: 'Contrato Ativado!',
      message: `O depósito caução foi confirmado e o contrato de aluguel para o imóvel "${contract.property.title}" está oficialmente ativo.`,
    };
    const action = { text: 'Ver Contrato', path: `/contratos/${contract.id}` };

    await this.notificationsService.create({
      userId: contract.tenant.id,
      user: contract.tenant,
      title: notification.title,
      message: notification.message,
      action: action,
      sendEmail: true,
    });

    await this.notificationsService.create({
      userId: contract.landlord.id,
      user: contract.landlord,
      title: notification.title,
      message: notification.message,
      action: action,
      sendEmail: true,
    });
  }

  async forceActivateContract(
    contractId: string,
    currentUser: { role: string; sub: string },
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas o locador pode ativar este contrato.',
      );
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ATIVO },
    });

    await this.contractPaymentService.createPaymentsAndFirstBankSlip(
      contractId,
    );

    await this.prisma.property.update({
      where: { id: contract.propertyId },
      data: { isAvailable: false },
    });
    await this.logHelper.createLog(
      currentUser.sub,
      'ACTIVATE',
      'Contract',
      contractId,
    );

    await this.notificationsService.create({
      userId: contract.tenant.id,
      user: {
        email: contract.tenant.email,
        name: contract.tenant.name,
      },
      title: 'Contrato de aluguel foi iniciado!',
      message: `O contrato de locação do imóvel "${contract.property.title}" foi iniciado com sucesso. Agora você pode acessar os detalhes do contrato.`,
      action: {
        text: 'Ver contrato',
        path: `/contratos/${contract.id}`,
      },
      sendEmail: true,
    });

    return updatedContract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    currentUser: { sub: string; role: string },
  ) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract)
      throw new NotFoundException(`Contrato com ID "${id}" não encontrado.`);

    if (
      currentUser.role !== ROLES.ADMIN &&
      currentUser.sub !== contract.landlordId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar este contrato.',
      );
    }
    const updatedContract = await this.prisma.contract.update({
      where: { id },
      data: updateContractDto,
    });
    await this.logHelper.createLog(
      currentUser?.sub,
      'UPDATE',
      'Contract',
      contract.id,
    );
    return updatedContract;
  }

  async cancelContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        landlord: { include: { subAccount: true } },
        property: { select: { title: true } },
        paymentsOrders: {
          where: { status: 'PENDENTE' },
          include: { charge: true },
        },
        GeneratedPdf: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para cancelar este contrato.',
      );
    }

    if (
      contract.status === ContractStatus.CANCELADO ||
      contract.status === ContractStatus.FINALIZADO
    ) {
      throw new BadRequestException(
        `Este contrato já está '${contract.status}' e não pode ser cancelado.`,
      );
    }
    if (contract.status === ContractStatus.AGUARDANDO_ASSINATURAS) {
      const activePdf = contract.GeneratedPdf[0];
      if (activePdf && activePdf.clicksignEnvelopeId) {
        this.logger.log(
          `Contrato ${contractId} está sendo cancelado. Solicitando exclusão do envelope ${activePdf.clicksignEnvelopeId} na Clicksign.`,
        );
        try {
          await this.clicksignService.deleteEnvelope(
            activePdf.clicksignEnvelopeId,
          );
          this.logger.log(
            `Envelope ${activePdf.clicksignEnvelopeId} excluído com sucesso.`,
          );
        } catch (error) {
          this.logger.error(
            `Falha ao excluir o envelope ${activePdf.clicksignEnvelopeId} na Clicksign. O processo de cancelamento do contrato continuará.`,
            error,
          );
        }
      }
    }

    const pendingOrdersWithSlips = contract.paymentsOrders.filter(
      (po) => po.charge,
    );

    if (pendingOrdersWithSlips.length > 0) {
      if (!contract.landlord.subAccount?.apiKey) {
        throw new InternalServerErrorException(
          'A API Key da subconta do locador não foi encontrada para cancelar as cobranças.',
        );
      }
      const apiKey = contract.landlord.subAccount.apiKey;

      for (const order of pendingOrdersWithSlips) {
        try {
          await this.paymentGateway.cancelCharge(
            apiKey,
            order.charge!.asaasChargeId,
          );
        } catch (error) {
          console.error(
            `Falha ao cancelar a cobrança ${order.charge!.asaasChargeId} no gateway.`,
            error,
          );
        }
      }
    }

    await this.prisma.paymentOrder.updateMany({
      where: {
        contractId: contractId,
        status: 'PENDENTE',
      },
      data: {
        status: 'CANCELADO',
      },
    });

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.CANCELADO },
    });
    this.logger.log(
      `Iniciando exclusão dos PDFs associados ao contrato cancelado ${contractId}.`,
    );
    await this.pdfsService.deletePdfsByContract(contractId);

    await this.logHelper.createLog(
      currentUser.sub,
      'CANCEL',
      'Contract',
      updatedContract.id,
    );

    await this.notificationsService.create({
      userId: contract.landlordId,
      user: {
        name: contract.landlord.name,
        email: contract.landlord.email,
      },
      title: 'Contrato Cancelado com Sucesso',
      message: `O contrato para o imóvel "${contract.property.title}" foi cancelado. Todas as cobranças pendentes associadas a ele também foram canceladas.`,
      action: {
        text: 'Ver Meus Contratos',
        path: '/contratos',
      },
      sendEmail: true,
    });

    return updatedContract;
  }

  async remove(id: string, currentUser: { sub: string; role: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        landlord: { include: { subAccount: true } },
        paymentsOrders: {
          where: { status: 'PENDENTE' },
          include: { charge: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contrato com ID "${id}" não encontrado.`);
    }

    if (
      currentUser.role !== ROLES.ADMIN &&
      currentUser.sub !== contract.landlordId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para remover este contrato.',
      );
    }

    const pendingOrdersWithSlips = contract.paymentsOrders.filter(
      (po) => po.charge,
    );

    if (pendingOrdersWithSlips.length > 0) {
      const apiKey = contract.landlord.subAccount?.apiKey;
      if (!apiKey) {
        console.warn(
          `API Key da subconta do locador não encontrada para o contrato ${id}. Não foi possível cancelar as cobranças no gateway.`,
        );
      } else {
        for (const order of pendingOrdersWithSlips) {
          try {
            await this.paymentGateway.cancelCharge(
              apiKey,
              order.charge!.asaasChargeId,
            );
          } catch (error) {
            console.error(
              `Falha ao cancelar a cobrança ${order.charge!.asaasChargeId} no gateway durante a remoção do contrato.`,
              error,
            );
          }
        }
      }
    }

    await this.pdfsService.deletePdfsByContract(id);
    await this.prisma.paymentOrder.deleteMany({ where: { contractId: id } });
    await this.prisma.contract.delete({ where: { id } });

    await this.logHelper.createLog(
      currentUser?.sub,
      'DELETE',
      'Contract',
      contract.id,
    );

    return {
      message:
        'Contrato e todas as suas cobranças associadas foram removidos com sucesso.',
    };
  }

  async deleteContractsByProperty(propertyId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { propertyId },
    });

    if (contracts.length === 0) {
      return;
    }

    for (const contract of contracts) {
      await this.pdfsService.deletePdfsByContract(contract.id);
    }
  }

  // /**
  //  * [Ação do Locador] Cancela um contrato que está aguardando o pagamento da caução.
  //  * Realiza uma limpeza completa: cancela cobranças, envelopes de assinatura e arquivos.
  //  */
  // async cancelForDepositNonPayment(
  //   contractId: string,
  //   currentUser: JwtPayload,
  // ) {
  //   const contract = await this.prisma.contract.findUnique({
  //     where: { id: contractId },
  //     include: {
  //       landlord: true,
  //       paymentsOrders: {
  //         where: { isSecurityDeposit: true },
  //         include: { charge: true },
  //       },
  //       GeneratedPdf: { orderBy: { generatedAt: 'desc' }, take: 1 },
  //     },
  //   });

  //   if (!contract || contract.landlordId !== currentUser.sub) {
  //     throw new ForbiddenException(
  //       'Você não tem permissão para cancelar este contrato.',
  //     );
  //   }
  //   if (contract.status !== ContractStatus.AGUARDANDO_GARANTIA) {
  //     throw new BadRequestException(
  //       'Esta ação só é permitida para contratos que estão aguardando o pagamento da caução.',
  //     );
  //   }

  //   this.logger.log(
  //     `Iniciando cancelamento por não pagamento da caução para o contrato ${contractId}.`,
  //   );

  //   const activePdf = contract.GeneratedPdf[0];
  //   if (activePdf?.clicksignEnvelopeId) {
  //     try {
  //       await this.clicksignService.deleteEnvelope(
  //         activePdf.clicksignEnvelopeId,
  //       );
  //       this.logger.log(
  //         `Envelope ${activePdf.clicksignEnvelopeId} na Clicksign foi cancelado.`,
  //       );
  //     } catch (error) {
  //       this.logger.error(
  //         `Falha ao cancelar envelope ${activePdf.clicksignEnvelopeId} na Clicksign. Continuando o processo.`,
  //         error,
  //       );
  //     }
  //   }

  //   // 2. Cancela cobrança da caução no Asaas
  //   const depositOrder = contract.paymentsOrders[0];
  //   if (depositOrder?.charge && contract.landlord.subAccount?.apiKey) {
  //     try {
  //       await this.paymentGateway.cancelCharge(
  //         contract.landlord.subAccount.apiKey,
  //         depositOrder.charge.asaasChargeId,
  //       );
  //       this.logger.log(
  //         `Cobrança da caução ${depositOrder.charge.asaasChargeId} cancelada no gateway.`,
  //       );
  //     } catch (error) {
  //       this.logger.error(
  //         `Falha ao cancelar a cobrança da caução ${depositOrder.charge.asaasChargeId}. Continuando.`,
  //         error,
  //       );
  //     }
  //   }

  //   await this.pdfsService.deletePdfsByContract(contractId);
  //   this.logger.log(`PDFs do contrato ${contractId} removidos do storage.`);

  //   const updatedContract = await this.prisma.contract.update({
  //     where: { id: contractId },
  //     data: { status: ContractStatus.CANCELADO },
  //   });

  //   await this.logHelper.createLog(
  //     currentUser.sub,
  //     'CANCEL_DEPOSIT_NON_PAYMENT',
  //     'Contract',
  //     contractId,
  //   );

  //   await this.notificationsService.create({
  //     userId: currentUser.sub,
  //     user: { name: contract.landlord.name, email: contract.landlord.email },
  //     title: 'Contrato Cancelado',
  //     message: `Você cancelou o contrato do imóvel "${contract.property.title}" devido ao não pagamento do depósito caução.`,
  //     action: { text: 'Ver Contratos', path: '/contratos' },
  //     sendEmail: false, // Apenas notificação na plataforma
  //   });

  //   return updatedContract;
  // }
}
