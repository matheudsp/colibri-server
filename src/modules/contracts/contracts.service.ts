import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import {
  User,
  UserRole,
  PaymentStatus,
  Prisma,
  ContractStatus,
} from '@prisma/client';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { UserService } from '../users/users.service';
import { LogHelperService } from '../logs/log-helper.service';
import { EmailJobType, type NotificationJob } from 'src/queue/jobs/email.job';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PaymentsOrdersService } from '../payments-orders/payments-orders.service';
import { QueueName } from 'src/queue/jobs/jobs';
import { PdfsService } from '../pdfs/pdfs.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ClicksignService } from '../clicksign/clicksign.service';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PropertiesService))
    private propertiesService: PropertiesService,
    private paymentsOrdersService: PaymentsOrdersService,
    private userService: UserService,
    private logHelper: LogHelperService,
    private pdfsService: PdfsService,
    private clicksignService: ClicksignService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
  ) {}
  async getContractPdfSignedUrl(contractId: string, currentUser: JwtPayload) {
    const contract = await this.findOne(contractId, currentUser);

    const pdf = await this.prisma.generatedPdf.findFirst({
      where: { contractId: contract.id, pdfType: 'CONTRATO_LOCACAO' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!pdf) {
      throw new NotFoundException(
        'Nenhum PDF de contrato foi gerado para esta locação ainda.',
      );
    }

    return this.pdfsService.getSignedUrl(pdf.id);
  }

  async resendNotification(
    contractId: string,
    signerId: string,
    currentUser: JwtPayload,
  ) {
    if (
      currentUser.role !== ROLES.LOCADOR &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas locadores ou administradores podem reenviar notificações.',
      );
    }

    const pdf = await this.prisma.generatedPdf.findFirst({
      where: { contractId: contractId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!pdf || !pdf.clicksignEnvelopeId) {
      throw new NotFoundException(
        'Nenhum processo de assinatura ativo (envelope) encontrado para este contrato.',
      );
    }

    const signatureRequest = await this.prisma.signatureRequest.findFirst({
      where: {
        generatedPdfId: pdf.id,
        signerId: signerId,
      },
    });

    if (!signatureRequest || !signatureRequest.clicksignSignerId) {
      throw new NotFoundException(
        'Solicitação de assinatura não encontrada para este usuário no documento.',
      );
    }

    await this.clicksignService.notifySigner(
      pdf.clicksignEnvelopeId,
      signatureRequest.clicksignSignerId,
    );

    return {
      message: `Solicitação de notificação para o signatário foi enviada com sucesso.`,
    };
  }

  async requestSignature(contractId: string, currentUser: JwtPayload) {
    if (currentUser.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para solicitar assinaturas.',
      );
    }

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (contract.status !== ContractStatus.AGUARDANDO_ASSINATURAS) {
      throw new BadRequestException(
        `A solicitação de assinatura só pode ser feita para contratos com status 'AGUARDANDO_ASSINATURAS'. O status atual é '${contract.status}'.`,
      );
    }

    return this.pdfsService.initiateSignatureProcess(contractId, currentUser);
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
      await this.paymentsOrdersService.createPaymentsForContract(contractId);

      const notification = {
        title: 'Contrato Assinado e Ativado!',
        message: `O contrato de aluguel para o imóvel "${contract.property.title}" foi assinado por todas as partes e agora está ativo.`,
      };

      const action = {
        text: 'Ver Contrato',
        path: `/contrato/${contract.id}`,
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

    // Calcula a data final baseada na data de início e duração
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
          path: `/contrato/${contract.id}/documentos`,
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

  async findAll(
    { page, limit }: { page: number; limit: number },
    currentUser: { sub: string; role: string },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ContractWhereInput = {};

    if (currentUser.role === ROLES.LOCADOR) {
      where.landlordId = currentUser.sub;
    } else if (currentUser.role === ROLES.LOCATARIO) {
      where.tenantId = currentUser.sub;
    } else if (currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para ver todos os contratos.',
      );
    }

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        skip,
        take: limit,
        where,
        include: {
          property: { select: { title: true } },
          landlord: { select: { name: true, email: true } },
          tenant: { select: { name: true, email: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);
    return {
      data: contracts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async forceActivateContract(
    contractId: string,
    currentUser: { role: string; sub: string },
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        landlord: {
          include: { bankAccount: true, subAccount: true },
        },
        tenant: {
          select: { name: true, email: true },
        },
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

    // if (contract.status !== ContractStatus.EM_ANALISE) {
    //   throw new BadRequestException(
    //     `O contrato não pode ser ativado pois seu status é "${contract.status}".`,
    //   );
    // }

    // // Cria subconta se necessário
    // await this.subaccountService.getOrCreateSubaccount(contract.landlord);

    // // Cria ou recupera customer do tenant vinculado à subconta do locador
    // await this.asaasCustomerService.getOrCreate(
    //   contract.tenant.id,
    //   contract.landlord.subAccount.id,
    // );

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ATIVO },
    });

    await this.paymentsOrdersService.createPaymentsForContract(contractId);
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
        path: `/contrato/${contract.id}`,
      },
    };

    await this.emailQueue.add(EmailJobType.NOTIFICATION, jobPayload);
    return updatedContract;
  }

  async findOne(id: string, currentUser: { sub: string; role: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        paymentsOrders: true,
        GeneratedPdf: { select: { signatureRequests: true } },
        property: true,
        landlord: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, email: true } },
        documents: { select: { id: true, status: true, type: true } },
      },
    });
    if (!contract) {
      throw new NotFoundException(`Contrato com ID "${id}" não encontrado.`);
    }
    if (
      contract.landlordId !== currentUser.sub &&
      contract.tenantId !== currentUser.sub &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para visualizar este contrato.',
      );
    }
    return contract;
  }

  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    currentUser: { sub: string; role: string },
  ) {
    const contract = await this.findOne(id, currentUser);
    if (
      currentUser.role !== ROLES.ADMIN &&
      currentUser.sub !== contract.landlordId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar este contrato.',
      );
    }
    await this.prisma.contract.update({
      where: { id },
      data: updateContractDto,
    });
    await this.logHelper.createLog(
      currentUser?.sub,
      'UPDATE',
      'Contract',
      contract.id,
    );
    return contract;
  }

  async cancelContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.findOne(contractId, currentUser); // Reutiliza o findOne para validar permissões

    if (
      contract.status === ContractStatus.CANCELADO ||
      contract.status === ContractStatus.FINALIZADO
    ) {
      throw new BadRequestException(
        `Este contrato já está '${contract.status}' e não pode ser cancelado.`,
      );
    }

    // Opcional, mas recomendado: Cancela todas as ordens de pagamento pendentes
    await this.prisma.paymentOrder.updateMany({
      where: {
        contractId: contractId,
        status: 'PENDENTE',
      },
      data: {
        status: 'CANCELADO',
      },
    });

    // Atualiza o status do contrato
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

    // Opcional: Enviar notificação de cancelamento para as partes

    return updatedContract;
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

  async remove(id: string, currentUser: { sub: string; role: string }) {
    const contract = await this.findOne(id, currentUser);
    if (
      currentUser.role !== ROLES.ADMIN &&
      currentUser.sub !== contract.landlordId
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para remover este contrato.',
      );
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
    return { message: 'Contrato removido com sucesso.' };
  }
}
