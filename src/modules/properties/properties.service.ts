import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { ROLES } from 'src/common/constants/roles.constant';
import { LogHelperService } from '../logs/log-helper.service';
import { SearchPropertyDto } from './dto/search-property.dto';
import { ContractStatus, type Prisma } from '@prisma/client';
import { PhotosService } from '../photos/photos.service';
import { ContractsService } from '../contracts/contracts.service';
import { DeletePropertyDto } from './dto/delete-property.dto';
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';
import { VerificationService } from '../verification/verification.service';
import type { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { CacheService } from 'cache/cache.service';

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
    @Inject(forwardRef(() => PhotosService))
    private propertyPhotosService: PhotosService,
    @Inject(forwardRef(() => ContractsService))
    private contractsService: ContractsService,
    private readonly cacheService: CacheService,
    private verificationService: VerificationService,
  ) {}

  private async clearPropertiesCache() {
    this.logger.log('Limpando chaves de cache de propriedades...');
    await this.cacheService.delByPattern('properties_available_*');
    await this.cacheService.delByPattern('user_properties_*');
  }

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
    await this.clearPropertiesCache();
    return property;
  }

  async findAvailable({ page, limit }: { page: number; limit: number }) {
    const cacheKey = `properties_available_page:${page}_limit:${limit}`;
    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData) {
      this.logger.log(`[CACHE HIT] Servindo dados de '${cacheKey}' do Redis.`);
      return cachedData;
    }

    this.logger.log(
      `[CACHE MISS] Buscando dados de '${cacheKey}' no banco de dados.`,
    );

    const skip = (page - 1) * limit;
    const where: Prisma.PropertyWhereInput = { isAvailable: true };

    const [properties, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        skip,
        take: limit,
        where,
        include: {
          landlord: { select: { name: true, email: true, phone: true } },
          photos: { where: { isCover: true }, take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const propertiesWithPublicUrls = await Promise.all(
      properties.map(async (property) => {
        const photosWithUrls =
          await this.propertyPhotosService.getPhotosByProperty(
            property.id,
            true,
          );
        return { ...property, photos: photosWithUrls };
      }),
    );

    const result = {
      properties: propertiesWithPublicUrls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheService.set(cacheKey, result, 300); // 300 segundos

    return result;
  }

  async findUserProperties(
    { page, limit }: { page: number; limit: number },
    currentUser: { sub: string; role: string },
  ) {
    const cacheKey = `user_properties:${currentUser.sub}_page:${page}_limit:${limit}`;

    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData) {
      this.logger.log(`[CACHE HIT] Servindo dados de '${cacheKey}' do Redis.`);
      return cachedData;
    }
    this.logger.log(
      `[CACHE MISS] Buscando dados de '${cacheKey}' no banco de dados.`,
    );

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

    const [propertiesFromDb, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        skip,
        take: limit,
        where,
        include: {
          landlord: { select: { name: true, email: true, phone: true } },
          photos: true,
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const properties = propertiesFromDb.map((p) => ({
      ...p,
      value: p.value.toNumber(),
    }));

    const propertiesWithSignedUrls = await Promise.all(
      properties.map(async (property) => {
        const photosWithUrls =
          await this.propertyPhotosService.getPhotosByProperty(
            property.id,
            true,
          );
        return { ...property, photos: photosWithUrls };
      }),
    );

    const result = {
      properties: propertiesWithSignedUrls,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheService.set(cacheKey, result, 300); // 300 segundos

    return result;
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

    const photosWithUrls = await this.propertyPhotosService.getPhotosByProperty(
      property.id,
      true,
    );
    return {
      ...property,
      photos: photosWithUrls,
      value: property.value.toNumber(),
    };
  }

  async publicSearch(params: Partial<SearchPropertyDto>) {
    const {
      q,
      state,
      transactionType,
      city,
      propertyType,
      page = 1,
      limit = 10,
      sort = 'createdAt:desc',
    } = params;

    const skip = (page - 1) * limit;

    const [sortField, sortDirection] = sort.split(':');
    const sortMap: Record<string, string> = {
      createdAt: 'createdAt',
      price: 'value',
      size: 'areaInM2',
    };
    const dbField = sortMap[sortField];

    if (!dbField) {
      throw new BadRequestException('Parâmetro de ordenação inválido.');
    }

    const orderBy: Prisma.PropertyOrderByWithRelationInput = {
      [dbField]: sortDirection as 'asc' | 'desc',
    };

    const where: Prisma.PropertyWhereInput = {
      isAvailable: true,
    };

    const andFilters: Prisma.PropertyWhereInput[] = [];
    if (transactionType) andFilters.push({ transactionType });
    if (propertyType) andFilters.push({ propertyType });
    if (state)
      andFilters.push({ state: { equals: state, mode: 'insensitive' } });
    if (city)
      andFilters.push({ city: { contains: city, mode: 'insensitive' } });

    if (q) {
      const normalizedQ = q.replace(/-/g, ' ').trim();
      andFilters.push({
        OR: [
          { title: { contains: normalizedQ, mode: 'insensitive' } },
          { street: { contains: normalizedQ, mode: 'insensitive' } },
          { district: { contains: normalizedQ, mode: 'insensitive' } },
          { city: { contains: normalizedQ, mode: 'insensitive' } },
          { state: { contains: normalizedQ, mode: 'insensitive' } },
          { cep: { contains: normalizedQ, mode: 'insensitive' } },
        ],
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [propertiesFromDb, total] = await this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          landlord: { select: { name: true, email: true } },
          photos: { where: { isCover: true }, take: 1 },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const properties = propertiesFromDb.map((p) => ({
      ...p,
      value: p.value.toNumber(),
    }));

    const propertiesWithSignedUrls = await Promise.all(
      properties.map(async (property) => {
        const photosWithUrls =
          await this.propertyPhotosService.getPhotosByProperty(
            property.id,
            true,
          );
        return { ...property, photos: photosWithUrls };
      }),
    );

    return {
      properties: propertiesWithSignedUrls,
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
    const { state, city, propertyType, page = 1, limit = 10 } = params;

    const skip = (page - 1) * limit;

    const andConditions: Prisma.PropertyWhereInput[] = [];

    if (currentUser.role !== ROLES.ADMIN) {
      andConditions.push({ landlordId: currentUser.sub });
    }

    const orConditions: Prisma.PropertyWhereInput[] = [];

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
    if (propertyType) {
      orConditions.push({
        propertyType: {
          equals: propertyType,
        },
      });
    }

    if (orConditions.length > 0) {
      andConditions.push({ OR: orConditions });
    }

    const where: Prisma.PropertyWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [propertiesFromDb, total] = await Promise.all([
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

    const properties = propertiesFromDb.map((p) => ({
      ...p,
      value: p.value.toNumber(),
    }));

    const propertiesWithSignedUrls = await Promise.all(
      properties.map(async (property) => {
        const photosWithUrls =
          await this.propertyPhotosService.getPhotosByProperty(
            property.id,
            true,
          );
        return { ...property, photos: photosWithUrls };
      }),
    );

    return {
      properties: propertiesWithSignedUrls,
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
      data: { ...updatePropertyDto },
      select: { id: true },
    });
    await this.logHelper.createLog(
      currentUser?.sub,
      'UPDATE',
      'Property',
      updatedProperty.id,
    );
    await this.clearPropertiesCache();

    return updatedProperty;
  }

  async remove(
    id: string,
    currentUser: JwtPayload,
    deleteDto: DeletePropertyDto,
  ) {
    const property = await this.findOne(id);

    const isOwner = property.landlordId === currentUser.sub;
    const isAdmin = currentUser.role === ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new UnauthorizedException(
        'Você não tem permissão para remover este imóvel.',
      );
    }

    if (currentUser.role === ROLES.LOCADOR) {
      if (!deleteDto.actionToken) {
        throw new BadRequestException(
          'O token de verificação (actionToken) é obrigatório para esta ação.',
        );
      }
      await this.verificationService.consumeActionToken(
        deleteDto.actionToken,
        VerificationContexts.DELETE_PROPERTY,
        currentUser.sub,
      );
    }

    await this.propertyPhotosService.deletePhotosByProperty(id);
    await this.contractsService.deleteContractsByProperty(id);
    await this.prisma.property.delete({ where: { id } });

    await this.logHelper.createLog(
      currentUser.sub,
      'DELETE',
      'Property',
      property.id,
    );

    await this.clearPropertiesCache();

    return {
      message:
        'Imóvel e todos os dados associados foram removidos com sucesso.',
    };
  }

  async validatePropertyExists(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Imóvel não encontrado');
    }

    return property;
  }

  async findAllPropertiesPaginated(skip: number, take: number) {
    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        skip,
        take,
      }),
      this.prisma.property.count(),
    ]);

    return [properties, total];
  }
}
