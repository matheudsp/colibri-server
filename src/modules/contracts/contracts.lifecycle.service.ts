import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Prisma, ContractStatus } from '@prisma/client';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { UserService } from '../users/users.service';
import { LogHelperService } from '../logs/log-helper.service';
import { EmailJobType, type NotificationJob } from 'src/queue/jobs/email.job';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { PdfsService } from '../pdfs/pdfs.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { ContractPaymentService } from './contracts.payment.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractLifecycleService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PropertiesService))
    private propertiesService: PropertiesService,
    private userService: UserService,
    private logHelper: LogHelperService,
    private pdfsService: PdfsService,
    private paymentGateway: PaymentGatewayService,
    private contractPaymentService: ContractPaymentService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
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
      const jobPayload: NotificationJob = {
        user: { email: tenant.email, name: tenant.name },
        notification: {
          title: 'Seu contrato de aluguel foi criado!',
          message: `O proprietário do imóvel "${property.title}" iniciou um processo de locação com você. O próximo passo é enviar seus documentos para análise.`,
        },
        action: {
          text: 'Acessar e Enviar Documentos',
          path: `/contratos/${contract.id}/documentos`,
        },
      };

      this.emailQueue.add(EmailJobType.NOTIFICATION, jobPayload);
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
        tenant: { select: { name: true, email: true } },
        landlord: { select: { name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (!contract) {
      return;
    }

    if (contract.status === ContractStatus.AGUARDANDO_ASSINATURAS) {
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

      this.emailQueue.add(EmailJobType.NOTIFICATION, {
        user: contract.tenant,
        notification,
        action,
      });

      this.emailQueue.add(EmailJobType.NOTIFICATION, {
        user: contract.landlord,
        notification,
        action,
      });

      console.log(`Contrato ${contractId} ativado com sucesso via webhook.`);
    } else {
      console.log(
        `Contrato ${contractId} já estava em um estado diferente de AGUARDANDO_ASSINATURAS. Nenhuma ação foi tomada.`,
      );
    }
  }

  async forceActivateContract(
    contractId: string,
    currentUser: { role: string; sub: string },
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenant: { select: { name: true, email: true } },
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

    const jobPayload: NotificationJob = {
      user: {
        email: contract.tenant.email,
        name: contract.tenant.name,
      },
      notification: {
        title: 'Contrato de aluguel foi iniciado!',
        message: `O contrato de locação do imóvel "${contract.property.title}" foi iniciado com sucesso. Agora você pode acessar os detalhes do contrato.`,
      },
      action: {
        text: 'Ver contrato',
        path: `/contratos/${contract.id}`,
      },
    };

    await this.emailQueue.add(EmailJobType.NOTIFICATION, jobPayload);
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

    await this.logHelper.createLog(
      currentUser.sub,
      'CANCEL',
      'Contract',
      updatedContract.id,
    );

    const job: NotificationJob = {
      user: {
        name: contract.landlord.name,
        email: contract.landlord.email,
      },
      notification: {
        title: 'Contrato Cancelado com Sucesso',
        message: `O contrato para o imóvel "${contract.property.title}" foi cancelado. Todas as cobranças pendentes associadas a ele também foram canceladas.`,
      },
      action: {
        text: 'Ver Meus Contratos',
        path: '/contratos',
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, job);

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
}
