import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { PropertyCacheService } from '../properties/properties-cache.service';

@Injectable()
export class PhotosService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,

    private readonly propertyCacheService: PropertyCacheService,
  ) {}

  async getPhotoById(id: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    return photo;
  }

  async updatePhoto(
    id: string,
    isCover: boolean | undefined,
    currentUser?: { role: string },
  ) {
    const photo = await this.prisma.photo.update({
      where: { id },
      data: { isCover },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            landlordId: true,
          },
        },
      },
    });
    if (photo.property) {
      await this.propertyCacheService.clearPropertiesCache(
        photo.property.landlordId,
      );
    }

    return {
      ...photo,
      url: await this.storageService.getSignedUrl(photo.filePath),
    };
  }

  async deletePhoto(id: string, currentUser?: { role: string }) {
    if (currentUser?.role === ROLES.LOCATARIO) {
      throw new ForbiddenException(
        'Locatários não têm permissão para deletar foto',
      );
    }

    const photo = await this.prisma.photo.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            landlordId: true,
          },
        },
      },
    });

    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    await this.storageService.deleteFile(photo.filePath, 'property-images');
    await this.prisma.photo.delete({ where: { id } });

    if (photo.property) {
      await this.propertyCacheService.clearPropertiesCache(
        photo.property.landlordId,
      );
    }

    return { success: true, message: 'Foto deletada com sucesso' };
  }
}
