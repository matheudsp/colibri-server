import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole, type Photo } from '@prisma/client';
import { ROLES } from 'src/common/constants/roles.constant';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

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
          property: { select: { title: true, photos: true } },
          landlord: { select: { name: true, email: true } },
          tenant: { select: { name: true, email: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    const dataWithSinglePhoto = contracts.map((contract) => {
      const coverPhoto = contract.property.photos.find((p) => p.isCover);
      const firstPhoto = contract.property.photos[0];
      const photoToUse = coverPhoto || firstPhoto;

      const photosWithUrl: (Photo & { url: string })[] = [];
      if (photoToUse) {
        photosWithUrl.push({
          ...photoToUse,
          url: this.storageService.getPublicImageUrl(photoToUse.filePath),
        });
      }

      return {
        ...contract,
        property: {
          ...contract.property,
          photos: photosWithUrl,
        },
      };
    });

    return {
      data: dataWithSinglePhoto,
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
      include: {
        paymentsOrders: {
          include: {
            charge: {
              select: { bankSlipUrl: true, transactionReceiptUrl: true },
            },
          },
        },
        signatureRequests: true, // Relação direta com as solicitações de assinatura
        property: {
          include: {
            photos: true,
          },
        },
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
    const coverPhoto = contract.property.photos.find((p) => p.isCover);
    const firstPhoto = contract.property.photos[0];
    const photoToUse = coverPhoto || firstPhoto;

    const photosWithUrl: (Photo & { url: string })[] = [];
    if (photoToUse) {
      photosWithUrl.push({
        ...photoToUse,
        url: this.storageService.getPublicImageUrl(photoToUse.filePath),
      });
    }

    const { ...contractWithoutGeneratedPdf } = contract;

    return {
      ...contractWithoutGeneratedPdf,
      property: {
        ...contract.property,
        photos: photosWithUrl,
      },
    };
  }
}
