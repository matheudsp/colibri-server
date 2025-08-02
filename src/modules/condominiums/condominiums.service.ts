import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import type { CreateCondominiumDto } from './dto/create-condominium.dto';
import { ROLES } from 'src/common/constants/roles.constant';
import type { Prisma } from '@prisma/client';
import type { UpdateCondominiumDto } from './dto/update-condominium.dto';
import type { SearchCondominiumDto } from './dto/search-condominium.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CondominiumsService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  async create(
    createCondominiumDto: CreateCondominiumDto,
    currentUser: { sub: string; role: string },
  ) {
    if (
      currentUser.role !== ROLES.LOCADOR &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Apenas locadores e administradores podem criar condomínios.',
      );
    }

    const condominium = await this.prisma.condominium.create({
      data: {
        ...createCondominiumDto,
        landlordId: currentUser.sub,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'CREATE',
      'Condominium',
      condominium.id,
    );

    return condominium;
  }

  async findAvailable({
    page = 1,
    limit = 10,
  }: {
    page: number;
    limit: number;
  }) {
    const skip = (page - 1) * limit;
    const where: Prisma.CondominiumWhereInput = {
      properties: {
        some: {
          isAvailable: true,
        },
      },
    };

    const [condominiums, total] = await this.prisma.$transaction([
      this.prisma.condominium.findMany({
        skip,
        take: limit,
        where,
        include: {
          _count: {
            select: { properties: { where: { isAvailable: true } } },
          },
          landlord: { select: { name: true, email: true } },
        },
      }),
      this.prisma.condominium.count({ where }),
    ]);

    return {
      data: condominiums,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserCondominiums(
    { page = 1, limit = 10 }: { page: number; limit: number },
    currentUser: { role: string; sub: string },
  ) {
    const cacheKey = `user_condominiums:${currentUser.sub}_page:${page}_limit:${limit}`;
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const skip = (page - 1) * limit;
    let where: Prisma.CondominiumWhereInput = {};

    if (currentUser.role === ROLES.LOCADOR) {
      where = { landlordId: currentUser.sub };
    } else if (currentUser.role === ROLES.LOCATARIO) {
      where = {
        properties: {
          some: {
            contracts: {
              some: {
                tenantId: currentUser.sub,
              },
            },
          },
        },
      };
    } else if (currentUser.role !== ROLES.ADMIN) {
      throw new ForbiddenException('Acesso não permitido.');
    }

    const [condominiums, total] = await this.prisma.$transaction([
      this.prisma.condominium.findMany({
        skip,
        take: limit,
        where,
        include: {
          properties: true,
          landlord: { select: { name: true, email: true } },
        },
      }),
      this.prisma.condominium.count({ where }),
    ]);

    const result = {
      data: condominiums,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, result);

    return result;
  }

  async findPropertiesByCondominium(
    condominiumId: string,
    { page = 1, limit = 10 }: { page: number; limit: number },
  ) {
    await this.findOne(condominiumId);

    const skip = (page - 1) * limit;
    const where: Prisma.PropertyWhereInput = {
      condominiumId: condominiumId,
    };

    const [properties, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        skip,
        take: limit,
        where,
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
  async publicSearch(params: Partial<SearchCondominiumDto>) {
    const { name, state, city, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CondominiumWhereInput = {
      properties: { some: { isAvailable: true } },
      AND: [],
    };

    const searchConditions: Prisma.CondominiumWhereInput[] = [];

    if (name) {
      searchConditions.push({ name: { contains: name, mode: 'insensitive' } });
    }
    if (state) {
      searchConditions.push({ state: { equals: state, mode: 'insensitive' } });
    }
    if (city) {
      searchConditions.push({ city: { contains: city, mode: 'insensitive' } });
    }

    if (searchConditions.length > 0) {
      (where.AND as Prisma.CondominiumWhereInput[]).push({
        OR: searchConditions,
      });
    }

    const [condominiums, total] = await this.prisma.$transaction([
      this.prisma.condominium.findMany({
        where,
        skip,
        take: limit,
        include: {
          landlord: { select: { name: true } },
          _count: {
            select: { properties: { where: { isAvailable: true } } },
          },
        },
      }),
      this.prisma.condominium.count({ where }),
    ]);

    return {
      data: condominiums,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async search(
    params: Partial<SearchCondominiumDto>,
    currentUser: { role: string; sub: string },
  ) {
    const { name, state, city, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CondominiumWhereInput = {};

    if (currentUser.role === ROLES.LOCADOR) {
      where.landlordId = currentUser.sub;
    } else if (currentUser.role !== ROLES.ADMIN) {
      // Locatários não têm uma rota de busca de condomínios por padrão,
      // Por enquanto, apenas locadores e admins podem usar a busca privada.
      throw new ForbiddenException('Acesso não permitido.');
    }

    const searchConditions: Prisma.CondominiumWhereInput[] = [];
    if (name)
      searchConditions.push({ name: { contains: name, mode: 'insensitive' } });
    if (state)
      searchConditions.push({ state: { equals: state, mode: 'insensitive' } });
    if (city)
      searchConditions.push({ city: { contains: city, mode: 'insensitive' } });

    if (searchConditions.length > 0) {
      where.AND = searchConditions;
    }

    const [condominiums, total] = await this.prisma.$transaction([
      this.prisma.condominium.findMany({
        where,
        skip,
        take: limit,
        include: { landlord: { select: { name: true } } },
      }),
      this.prisma.condominium.count({ where }),
    ]);

    return {
      data: condominiums,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const condominium = await this.prisma.condominium.findUnique({
      where: { id },
    });

    if (!condominium) {
      throw new NotFoundException(`Condomínio com ID "${id}" não encontrado.`);
    }

    return condominium;
  }

  async update(
    id: string,
    updateCondominiumDto: UpdateCondominiumDto,
    currentUser: { role: string; sub: string },
  ) {
    const condominium = await this.findOne(id);
    if (
      condominium.landlordId !== currentUser.sub ||
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para editar este imóvel.',
      );
    }

    const updatedCondominium = await this.prisma.condominium.update({
      where: { id },
      data: updateCondominiumDto,
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'UPDATE',
      'Condominium',
      id,
    );

    return updatedCondominium;
  }

  async remove(id: string, currentUser: { role: string; sub: string }) {
    const condominium = await this.findOne(id);
    if (
      condominium.landlordId !== currentUser.sub ||
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new UnauthorizedException(
        'Você não tem permissão para remover este imóvel.',
      );
    }
    await this.prisma.condominium.delete({ where: { id } });

    await this.logHelper.createLog(
      currentUser.sub,
      'DELETE',
      'Condominium',
      id,
    );

    return { message: 'Condomínio removido com sucesso.' };
  }
}
