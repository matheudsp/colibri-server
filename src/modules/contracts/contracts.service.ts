import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { User, UserRole, PaymentStatus, Prisma } from '@prisma/client';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private propertiesService: PropertiesService,
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

    const property = await this.propertiesService.findOne(
      createContractDto.propertyId,
    );
    if (property.landlordId !== currentUser.sub) {
      throw new UnauthorizedException(
        'Você não é o proprietário deste imóvel.',
      );
    }

    // Calcula a data final baseada na data de início e duração
    const startDate = new Date(createContractDto.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + createContractDto.durationInMonths);

    const contract = await this.prisma.contract.create({
      data: {
        ...createContractDto,
        landlordId: currentUser.sub,
        startDate: startDate,
        endDate: endDate, // Salva a data final calculada
      },
    });

    const payments: Prisma.PaymentCreateManyInput[] = [];

    for (let i = 0; i < contract.durationInMonths; i++) {
      const dueDate = new Date(contract.startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      payments.push({
        contractId: contract.id,
        amountDue:
          contract.rentAmount +
          (contract.condoFee ?? 0) +
          (contract.iptuFee ?? 0),
        dueDate: dueDate,
        status: PaymentStatus.PENDENTE,
      });
    }

    // Gera todos os pagamentos do contrato de uma vez
    await this.prisma.payment.createMany({ data: payments });

    return contract;
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
    return this.prisma.contract.update({
      where: { id },
      data: updateContractDto,
    });
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
    // Lógica para remoção (ex: soft delete ou remoção em cascata)
    // Aqui, vamos apenas deletar o contrato para simplificar
    await this.prisma.payment.deleteMany({ where: { contractId: id } });
    await this.prisma.contract.delete({ where: { id } });
    return { message: 'Contrato removido com sucesso.' };
  }
}
