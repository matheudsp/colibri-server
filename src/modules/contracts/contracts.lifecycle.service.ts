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
import { StorageService } from 'src/storage/storage.service';
import type { UpdateContractHtmlDto } from './dto/update-contract-html.dto';

@Injectable()
export class ContractLifecycleService {
  private readonly logger = new Logger(ContractLifecycleService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PropertiesService))
    private readonly propertiesService: PropertiesService,
    private readonly userService: UserService,
    private readonly logHelper: LogHelperService,
    @Inject(forwardRef(() => PdfsService))
    private readonly pdfsService: PdfsService,
    private readonly paymentGateway: PaymentGatewayService,
    private readonly contractPaymentService: ContractPaymentService,
    @Inject(forwardRef(() => PaymentsOrdersService))
    private readonly paymentsOrdersService: PaymentsOrdersService,
    private readonly notificationsService: NotificationsService,
    private readonly clicksignService: ClicksignService,
    private readonly storageService: StorageService,
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
        status: ContractStatus.EM_ELABORACAO,
      },
    });

    await this.logHelper.createLog(
      currentUser?.sub,
      'CREATE',
      'Contract',
      contract.id,
    );

    // if (property && tenant) {
    //   await this.notificationsService.create({
    //     userId: tenant.id,
    //     user: { email: tenant.email, name: tenant.name },
    //     title: 'Seu contrato de aluguel foi criado!',
    //     message: `O proprietário do imóvel "${property.title}" iniciou um processo de locação com você. O próximo passo é enviar seus documentos para análise.`,
    //     action: {
    //       text: 'Acessar e Enviar Documentos',
    //       path: `/contratos/${contract.id}/documentos`,
    //     },
    //     sendEmail: true,
    //   });
    // }

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

      this.logger.log(
        `Contrato ${contractId} ativado com sucesso via webhook.`,
      );
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

    // Se o contrato estiver aguardando assinaturas, cancela o envelope na Clicksign
    if (
      contract.status === ContractStatus.AGUARDANDO_ASSINATURAS &&
      contract.clicksignEnvelopeId
    ) {
      this.logger.log(
        `Cancelando envelope ${contract.clicksignEnvelopeId} na Clicksign.`,
      );
      try {
        await this.clicksignService.deleteEnvelope(
          contract.clicksignEnvelopeId,
        );
      } catch (error) {
        this.logger.error(
          `Falha ao excluir o envelope na Clicksign. O processo continuará.`,
          error,
        );
      }
    }

    const pendingOrdersWithCharges = contract.paymentsOrders.filter(
      (po) => po.charge,
    );

    if (pendingOrdersWithCharges.length > 0) {
      if (!contract.landlord.subAccount?.apiKey) {
        throw new InternalServerErrorException(
          'A API Key da subconta do locador não foi encontrada para cancelar as cobranças.',
        );
      }
      const apiKey = contract.landlord.subAccount.apiKey;

      for (const order of pendingOrdersWithCharges) {
        try {
          await this.paymentGateway.cancelCharge(
            apiKey,
            order.charge!.asaasChargeId,
          );
        } catch (error) {
          this.logger.error(
            `Falha ao cancelar a cobrança ${order.charge!.asaasChargeId} no gateway.`,
            error,
          );
        }
      }
    }

    await this.prisma.paymentOrder.updateMany({
      where: { contractId: contractId, status: 'PENDENTE' },
      data: { status: 'CANCELADO' },
    });

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.CANCELADO },
    });

    await this.deleteContractPdfsFromStorage(contract);
    await this.pdfsService.deleteAccessoryPdfsByContract(contractId);

    await this.logHelper.createLog(
      currentUser.sub,
      'CANCEL',
      'Contract',
      updatedContract.id,
    );

    await this.notificationsService.create({
      userId: contract.landlordId,
      user: { name: contract.landlord.name, email: contract.landlord.email },
      title: 'Contrato Cancelado com Sucesso',
      message: `O contrato para o imóvel "${contract.property.title}" foi cancelado. Todas as cobranças pendentes associadas a ele também foram canceladas.`,
      action: { text: 'Ver Meus Contratos', path: '/contratos' },
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

    // Deleta os arquivos de PDF do storage
    await this.deleteContractPdfsFromStorage(contract);

    // Deleta os PDFs acessórios (relatórios)
    await this.pdfsService.deleteAccessoryPdfsByContract(id);

    // As outras deleções (PaymentOrder, etc.) ocorrerão em cascata devido ao schema
    await this.prisma.contract.delete({ where: { id } });

    await this.logHelper.createLog(
      currentUser?.sub,
      'DELETE',
      'Contract',
      contract.id,
    );

    return {
      message:
        'Contrato e todos os seus dados associados foram removidos com sucesso.',
    };
  }

  private async deleteContractPdfsFromStorage(contract: any) {
    const filesToDelete: string[] = [];
    if (contract.contractFilePath) {
      filesToDelete.push(contract.contractFilePath);
    }
    if (contract.signedContractFilePath) {
      filesToDelete.push(contract.signedContractFilePath);
    }
    if (filesToDelete.length > 0) {
      this.logger.log(
        `Deletando ${filesToDelete.length} arquivos de contrato do storage para o contrato ${contract.id}`,
      );
      await this.storageService.deleteFiles(filesToDelete);
    }
  }

  async deleteContractsByProperty(propertyId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { propertyId },
    });

    if (contracts.length === 0) {
      return;
    }

    // Deleta todos os arquivos associados a cada contrato antes de deletar o contrato
    for (const contract of contracts) {
      await this.deleteContractPdfsFromStorage(contract);
      await this.pdfsService.deleteAccessoryPdfsByContract(contract.id);
    }

    // O Prisma irá deletar os contratos em cascata quando a propriedade for deletada
  }

  async updateContractHtml(
    contractId: string,
    dto: UpdateContractHtmlDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: { select: { title: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado.');
    if (contract.landlordId !== currentUser.sub)
      throw new ForbiddenException(
        'Apenas o locador pode editar este contrato.',
      );
    if (contract.status !== ContractStatus.EM_ELABORACAO) {
      throw new BadRequestException(
        `O contrato não está mais na fase de elaboração (Status atual: ${contract.status}).`,
      );
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        contractHtml: dto.contractHtml,
        status: ContractStatus.AGUARDANDO_ACEITE_INQUILINO,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'FINALIZE_CONTRACT_DRAFT',
      'Contract',
      contractId,
    );

    await this.notificationsService.create({
      userId: contract.tenant.id,
      user: { email: contract.tenant.email, name: contract.tenant.name },
      title: 'Seu contrato está pronto para revisão',
      message: `O locador do imóvel "${contract.property.title}" finalizou a elaboração do contrato. Por favor, leia os termos e aceite-os para podermos prosseguir para a fase de documentação.`,
      action: {
        text: 'Revisar e Aceitar Contrato',
        path: `/contratos/${contract.id}/revisar`,
      },
      sendEmail: true,
    });

    return {
      message:
        'Contrato salvo. Aguardando aceite do inquilino para prosseguir.',
    };
  }

  /**
   * NOVO MÉTODO: Chamado quando o inquilino aceita os termos do contrato.
   */
  async tenantAcceptsContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        property: { select: { title: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
    });

    if (!contract) throw new NotFoundException('Contrato não encontrado.');
    if (contract.tenantId !== currentUser.sub)
      throw new ForbiddenException(
        'Apenas o inquilino deste contrato pode aceitá-lo.',
      );
    if (contract.status !== ContractStatus.AGUARDANDO_ACEITE_INQUILINO) {
      throw new BadRequestException(
        `O contrato não está aguardando seu aceite (Status atual: ${contract.status}).`,
      );
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: ContractStatus.PENDENTE_DOCUMENTACAO, // Avança para a próxima fase
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'TENANT_ACCEPTS_CONTRACT',
      'Contract',
      contractId,
    );

    await this.notificationsService.create({
      userId: contract.tenant.id,
      user: { email: contract.tenant.email, name: contract.tenant.name },
      title: 'Ação necessária: Envie seus documentos',
      message: `Oba! Notamos que você aceitou os termos do contrato para o imóvel "${contract.property.title}". O próximo passo é o envio dos seus documentos para análise do locador.`,
      action: {
        text: 'Enviar Documentos',
        path: `/contratos/${contract.id}/documentos`,
      },
      sendEmail: true,
    });

    return {
      message:
        'Contrato aceito com sucesso! Agora você pode enviar seus documentos.',
    };
  }
}
