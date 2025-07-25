import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ROLES } from 'src/common/constants/roles.constant';
import { LogHelperService } from '../logs/log-helper.service';
import type { SearchPropertyDto } from './dto/search-property.dto';
import { ContractStatus, type Prisma } from '@prisma/client';

@Injectable()
export class PropertiesService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
  ) {}

  async create(
    createPropertyDto: CreatePropertyDto,
    currentUser: { sub: string; role: string },
  ) {
    if (
      currentUser.role !== ROLES.LOCADOR &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Apenas locadores e administradores podem criar imóveis.',
      );
    }

    const property = await this.prisma.property.create({
      data: {
        ...createPropertyDto,
        landlordId: currentUser.sub,
      },
    });

    await this.logHelper.createLog(
      currentUser?.sub,
      'CREATE',
      'Property',
      property.id,
    );

    return property;
  }

  async findAvailable({ page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;
    const where: Prisma.PropertyWhereInput = { isAvailable: true };

    const [properties, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        skip,
        take: limit,
        where,
        include: {
          landlord: { select: { name: true, email: true, phone: true } },
          photos: { take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserProperties(
    { page, limit }: { page: number; limit: number },
    currentUser: { sub: string; role: string },
  ) {
    const skip = (page - 1) * limit;
    let where: Prisma.PropertyWhereInput = {};

    if (currentUser.role === ROLES.LOCADOR) {
      where = { landlordId: currentUser.sub };
    } else if (currentUser.role === ROLES.LOCATARIO) {
      where = {
        contracts: {
          some: {
            tenantId: currentUser.sub,
            status: {
              in: [
                ContractStatus.ATIVO,
                ContractStatus.PENDENTE_DOCUMENTACAO,
                ContractStatus.EM_ANALISE,
                ContractStatus.AGUARDANDO_ASSINATURAS,
              ],
            },
          },
        },
      };
    } else if (currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar estas propriedades.',
      );
    }

    const [properties, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        skip,
        take: limit,
        where,
        include: {
          landlord: { select: { name: true, email: true, phone: true } },
          photos: { take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        landlord: { select: { name: true, email: true, phone: true } },
        photos: true,
      },
    });

    if (!property) {
      throw new NotFoundException(`Imóvel com ID "${id}" não encontrado.`);
    }
    return property;
  }

  async publicSearch(params: Partial<SearchPropertyDto>) {
    const { title, state, city, page = 1, limit = 10 } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {
      isAvailable: true,
      AND: [],
    };

    const searchConditions: Prisma.PropertyWhereInput[] = [];

    if (title) {
      searchConditions.push({
        title: {
          contains: title,
          mode: 'insensitive',
        },
      });
    }
    if (state) {
      searchConditions.push({
        state: {
          equals: state,
          mode: 'insensitive',
        },
      });
    }
    if (city) {
      searchConditions.push({
        city: {
          contains: city,
          mode: 'insensitive',
        },
      });
    }

    if (searchConditions.length > 0) {
      (where.AND as Prisma.PropertyWhereInput[]).push({ OR: searchConditions });
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          landlord: { select: { name: true, email: true } },
          photos: { take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(
    params: Partial<SearchPropertyDto>,
    currentUser: { role: string; sub: string },
  ) {
    const { title, state, city, page = 1, limit = 10 } = params;

    const skip = (page - 1) * limit;

    const andConditions: Prisma.PropertyWhereInput[] = [];

    if (currentUser.role !== ROLES.ADMIN) {
      andConditions.push({ landlordId: currentUser.sub });
    }

    const orConditions: Prisma.PropertyWhereInput[] = [];
    if (title) {
      orConditions.push({
        title: {
          contains: title,
          mode: 'insensitive',
        },
      });
    }
    if (state) {
      orConditions.push({
        state: {
          startsWith: state,
          mode: 'insensitive',
        },
      });
    }
    if (city) {
      orConditions.push({
        city: {
          startsWith: city,
          mode: 'insensitive',
        },
      });
    }

    if (orConditions.length > 0) {
      andConditions.push({ OR: orConditions });
    }

    const where: Prisma.PropertyWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          landlord: { select: { name: true, email: true, phone: true } },
          photos: true,
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    currentUser: { sub: string; role: string },
  ) {
    const property = await this.findOne(id);

    if (
      property.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para editar este imóvel.',
      );
    }

    const updatedProperty = await this.prisma.property.update({
      where: { id },
      data: updatePropertyDto,
      select: { id: true },
    });
    await this.logHelper.createLog(
      currentUser?.sub,
      'UPDATE',
      'Property',
      updatedProperty.id,
    );
    return updatedProperty;
  }

  async remove(id: string, currentUser: { sub: string; role: string }) {
    const property = await this.findOne(id);
    if (
      property.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para remover este imóvel.',
      );
    }
    await this.prisma.property.delete({ where: { id } });
    await this.logHelper.createLog(
      currentUser?.sub,
      'DELETE',
      'Property',
      property.id,
    );
    return { message: 'Imóvel removido com sucesso.' };
  }
}
