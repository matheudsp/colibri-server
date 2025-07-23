import {
  ForbiddenException,
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

@Injectable()
export class CondominiumsService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
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

  async findAll(
    { page = 1, limit = 10 }: { page: number; limit: number },
    currentUser: { role: string; sub: string },
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.CondominiumWhereInput = {};

    // Se o usuário for LOCADOR, filtra pelos condomínios do locador
    if (currentUser.role === ROLES.LOCADOR) {
      where.landlordId = currentUser.sub;
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

  async findProperties(
    condominiumId: string,
    { page = 1, limit = 10 }: { page: number; limit: number },
  ) {
    // 1. Primeiro, verifica se o usuário tem permissão para ver o condomínio
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
