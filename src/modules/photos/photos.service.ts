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
import { SupabaseClient } from '@supabase/supabase-js';
import { InjectSupabaseClient } from 'nestjs-supabase-js';
import { PropertiesService } from '../properties/properties.service';
import { ROLES } from 'src/common/constants/roles.constant';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    @Inject(forwardRef(() => PropertiesService))
    private propertyService: PropertiesService,
    @InjectSupabaseClient() private supabase: SupabaseClient,
  ) {}

  async uploadPhotos(files: Express.Multer.File[], propertyId: string) {
    const property =
      await this.propertyService.validatePropertyExists(propertyId);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const invalidFiles = files.filter(
      (file) =>
        file.size > MAX_FILE_SIZE || !file.mimetype?.startsWith('image/'),
    );

    if (invalidFiles.length > 0) {
      throw new BadRequestException(
        `Arquivos inválidos: tamanho máximo 10MB e apenas imagens são permitidas`,
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
            { folder: `properties/${property.id}` },
          );

          return this.prisma.photo.create({
            data: {
              name: `Foto${photoNumber}-${property.title}`,
              propertyId,
              filePath: uploadResult.key,
              isCover: false,
            },
          });
        }),
      );

      return uploadedPhotos;
    } catch {
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

  async getPhotosByProperty(propertyId: string, includeSignedUrl = false) {
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

    if (includeSignedUrl) {
      return Promise.all(
        photos.map(async (photo) => {
          try {
            return {
              ...photo,
              signedUrl: await this.storageService.getSignedUrl(photo.filePath),
            };
          } catch (error) {
            this.logger.error(
              `Falha ao obter URL assinada para a foto ${photo.id}`,
              error.stack,
            );
            return {
              ...photo,
              signedUrl: '',
            };
          }
        }),
      );
    }

    return photos;
  }

  async deletePhotosByProperty(propertyId: string) {
    const photos = await this.prisma.photo.findMany({
      where: { propertyId },
    });

    if (photos.length === 0) {
      return;
    }

    const filePathsToDelete = photos.map((photo) => photo.filePath);

    await this.storageService.deleteFiles(filePathsToDelete);

    await this.prisma.photo.deleteMany({
      where: { propertyId },
    });
  }

  async updatePhoto(
    id: string,
    isCover: boolean | undefined,
    currentUser?: { role: string },
  ) {
    if (currentUser?.role === 'vistoriador') {
      throw new ForbiddenException(
        'Vistoriadores não têm permissão para atualizar foto',
      );
    }

    const photo = await this.prisma.photo.update({
      where: { id },
      data: { isCover },
      include: {
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

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

    const photo = await this.prisma.photo.findUnique({ where: { id } });
    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    await this.storageService.deleteFile(photo.filePath);
    await this.prisma.photo.delete({ where: { id } });

    return { success: true, message: 'Foto deletada com sucesso' };
  }
}
