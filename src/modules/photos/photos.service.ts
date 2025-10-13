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
    @Inject(forwardRef(() => PropertiesService))
    private propertyService: PropertiesService,
    private readonly propertyCacheService: PropertyCacheService,
  ) {}

  async uploadPropertyPhotos(files: Express.Multer.File[], propertyId: string) {
    const property =
      await this.propertyService.validatePropertyExists(propertyId);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const invalidFiles = files.filter(
      (file) =>
        file.size > MAX_FILE_SIZE || !file.mimetype?.startsWith('image/'),
    );

    if (invalidFiles.length > 0) {
      throw new BadRequestException(
        `Apenas imagens são aceitas — limite de 10 MB por arquivo.`,
      );
    }

    const existingPhotoCount = await this.prisma.photo.count({
      where: { propertyId },
    });

    try {
      const uploadedPhotos = await Promise.all(
        files.map(async (file, index) => {
          const photoNumber = existingPhotoCount + index + 1;
          const fileToUpload = {
            originalname: file.originalname || `photo-${Date.now()}.jpg`,
            buffer: file.buffer,
            mimetype: file.mimetype || 'image/jpeg',
            size: file.size,
          };
          const uploadResult = await this.storageService.uploadFile(
            fileToUpload,
            { folder: `properties/${property.id}`, bucket: 'property-images' },
          );

          const newPhoto = await this.prisma.photo.create({
            data: {
              name: `Foto${photoNumber}-${property.title}`,
              propertyId,
              filePath: uploadResult.key,
              isCover: false,
            },
          });
          return {
            ...newPhoto,
            url: this.storageService.getPublicImageUrl(newPhoto.filePath),
          };
        }),
      );
      await this.propertyCacheService.clearPropertiesCache(property.landlordId);
      return uploadedPhotos;
    } catch (error) {
      console.error('Falha no upload de fotos:', error);
      throw new InternalServerErrorException('Falha ao fazer upload das fotos');
    }
  }

  async getPhotoById(id: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    return photo;
  }

  async getPhotosByProperty(propertyId: string, includePublicUrl = false) {
    const photos = await this.prisma.photo.findMany({
      where: { propertyId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (includePublicUrl) {
      return photos.map((photo) => {
        return {
          ...photo,

          url: this.storageService.getPublicImageUrl(photo.filePath),
        };
      });
    }

    return photos;
  }

  async deletePhotosByProperty(propertyId: string) {
    const photos = await this.prisma.photo.findMany({
      where: { propertyId },
      include: {
        property: true,
      },
    });

    if (photos.length === 0) {
      return;
    }

    const landlordId = photos[0]?.property?.landlordId;

    const filePathsToDelete = photos.map((photo) => photo.filePath);

    await this.storageService.deleteFiles(filePathsToDelete, 'property-images');

    await this.prisma.photo.deleteMany({
      where: { propertyId },
    });

    if (landlordId) {
      await this.propertyCacheService.clearPropertiesCache(landlordId);
    }
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
