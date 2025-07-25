import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
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

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private propertiesService: PropertiesService,
    private userService: UserService,
    private logHelper: LogHelperService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  // async create(
  //   createContractDto: CreateContractDto,
  //   currentUser: { sub: string; role: string },
  // ) {
  //   if (currentUser.role !== ROLES.LOCADOR) {
  //     throw new UnauthorizedException(
  //       'Apenas locadores podem criar contratos.',
  //     );
  //   }

  //   const {
  //     propertyId,
  //     tenantEmail,
  //     tenantName,
  //     tenantCpf,
  //     tenantPassword,
  //     ...contractData
  //   } = createContractDto;

  //   const property = await this.propertiesService.findOne(propertyId);
  //   if (property.landlordId !== currentUser.sub) {
  //     throw new UnauthorizedException(
  //       'Você não é o proprietário deste imóvel.',
  //     );
  //   }

  //   const tenant = await this.userService.findOrCreate(
  //     {
  //       email: tenantEmail,
  //       name: tenantName,
  //       cpfCnpj: tenantCpf,
  //       password: tenantPassword,
        
  //     },
  //     ROLES.LOCATARIO,
  //   );

  //   // Calcula a data final baseada na data de início e duração
  //   const startDate = new Date(contractData.startDate);
  //   const endDate = new Date(startDate);
  //   endDate.setMonth(startDate.getMonth() + contractData.durationInMonths);

  //   const contract = await this.prisma.contract.create({
  //     data: {
  //       ...contractData,
  //       propertyId,
  //       landlordId: currentUser.sub,
  //       tenantId: tenant.id,
  //       startDate,
  //       endDate,
  //       status: ContractStatus.PENDENTE_DOCUMENTACAO,
  //     },
  //   });

  //   await this.logHelper.createLog(
  //     currentUser?.sub,
  //     'CREATE',
  //     'Contract',
  //     contract.id,
  //   );

  //   if (property && tenant) {
  //     const jobPayload: NotificationJob = {
  //       user: { email: tenant.email, name: tenant.name },
  //       notification: {
  //         title: 'Seu contrato de aluguel foi iniciado!',
  //         message: `O proprietário do imóvel "${property.title}" iniciou um processo de locação com você. O próximo passo é enviar seus documentos para análise.`,
  //       },
  //       action: {
  //         text: 'Acessar e Enviar Documentos',
  //         path: `/contracts/${contract.id}/documents`,
  //       },
  //     };

  //     await this.emailQueue.add(EmailJobType.NOTIFICATION, jobPayload);
  //   }

  //   return contract;
  // }

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
          landlord: { select: { name: true } },
          tenant: { select: { name: true } },
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

  async activateContract(
    contractId: string,
    currentUser: { role: string; sub: string },
  ) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
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

    if (contract.status !== ContractStatus.EM_ANALISE) {
      throw new BadRequestException(
        `O contrato não pode ser ativado pois seu status é "${contract.status}".`,
      );
    }

    const updatedContract = await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ATIVO },
    });

    // await this.generatePaymentsForContract(contractId);

    await this.logHelper.createLog(
      currentUser.sub,
      'ACTIVATE',
      'Contract',
      contractId,
    );

    // Notificar o locatário que o contrato está ativo utilizando template de notificacao
    // Enfileirar email

    return updatedContract;
  }

  async findOne(id: string, currentUser: { sub: string; role: string }) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { payments: true, property: true },
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
    const contract = await this.findOne(id, currentUser); // findOne já faz a verificação de permissão
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
    // A aplicar soft delete ou remoção em cascata
    await this.prisma.payment.deleteMany({ where: { contractId: id } });
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
