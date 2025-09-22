import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, Property, UserRole } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';
import { PropertiesService } from './properties.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PhotosService } from '../photos/photos.service';
import { ContractsService } from '../contracts/contracts.service';
import { VerificationService } from '../verification/verification.service';
import { LogHelperService } from '../logs/log-helper.service';
import { CacheService } from '../cache/cache.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let verificationServiceMock: DeepMockProxy<VerificationService>;
  let photosServiceMock: DeepMockProxy<PhotosService>;
  let contractsServiceMock: DeepMockProxy<ContractsService>;
  let cacheServiceMock: DeepMockProxy<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: PhotosService, useValue: mockDeep<PhotosService>() },
        { provide: ContractsService, useValue: mockDeep<ContractsService>() },
        {
          provide: VerificationService,
          useValue: mockDeep<VerificationService>(),
        },
        { provide: CacheService, useValue: mockDeep<CacheService>() },
        { provide: LogHelperService, useValue: mockDeep<LogHelperService>() },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    prismaMock = module.get(PrismaService);
    verificationServiceMock = module.get(VerificationService);
    photosServiceMock = module.get(PhotosService);
    contractsServiceMock = module.get(ContractsService);
    cacheServiceMock = module.get(CacheService);

    mockReset(prismaMock);
    mockReset(verificationServiceMock);
    mockReset(photosServiceMock);
    mockReset(contractsServiceMock);
    mockReset(cacheServiceMock);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreatePropertyDto = {
      title: 'New Property',
      // landlordId: 'landlord-1',
      propertyType: 'CASA',
      value: 2000,
      areaInM2: 100,
      numRooms: 3,
      numBathrooms: 2,
      numParking: 1,
      cep: '12345678',
      street: 'Rua Teste',
      number: '123',
      district: 'Bairro Teste',
      city: 'Cidade Teste',
      state: 'TS',
    };

    it('should create a property for a LOCADOR', async () => {
      const currentUser = { sub: 'landlord-1', role: UserRole.LOCADOR };
      const expectedProperty = { id: 'prop-1', ...createDto };

      (prismaMock.property.create as jest.Mock).mockResolvedValue(
        expectedProperty,
      );

      await expect(
        service.create(createDto, currentUser as JwtPayload),
      ).resolves.toEqual(expectedProperty);
      expect(prismaMock.property.create).toHaveBeenCalledWith({
        data: { ...createDto, landlordId: currentUser.sub },
      });
      expect(cacheServiceMock.delByPattern).toHaveBeenCalledWith(
        expect.stringContaining('properties'),
      );
    });

    it('should throw UnauthorizedException if user is not a LOCADOR or ADMIN', async () => {
      const currentUser = { sub: 'tenant-1', role: UserRole.LOCATARIO };

      await expect(
        service.create(createDto, currentUser as JwtPayload),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('remove', () => {
    const propertyId = 'prop-to-delete';
    const mockProperty: Partial<Property> = {
      id: propertyId,
      landlordId: 'owner-id',
    };

    it('should allow an ADMIN to delete a property without a token', async () => {
      const adminUser = { sub: 'admin-id', role: UserRole.ADMIN };
      (prismaMock.property.findUnique as jest.Mock).mockResolvedValue(
        mockProperty,
      );

      await service.remove(propertyId, adminUser as JwtPayload, {});

      expect(verificationServiceMock.consumeActionToken).not.toHaveBeenCalled();
      expect(photosServiceMock.deletePhotosByProperty).toHaveBeenCalledWith(
        propertyId,
      );
      expect(
        contractsServiceMock.deleteContractsByProperty,
      ).toHaveBeenCalledWith(propertyId);
      expect(prismaMock.property.delete).toHaveBeenCalledWith({
        where: { id: propertyId },
      });
      expect(cacheServiceMock.delByPattern).toHaveBeenCalled();
    });

    it('should require a token for a LOCADOR to delete a property', async () => {
      const ownerUser = { sub: 'owner-id', role: UserRole.LOCADOR };
      const deleteDto = { actionToken: 'valid-token' };

      (prismaMock.property.findUnique as jest.Mock).mockResolvedValue(
        mockProperty,
      );

      await service.remove(propertyId, ownerUser as JwtPayload, deleteDto);

      expect(verificationServiceMock.consumeActionToken).toHaveBeenCalledWith(
        deleteDto.actionToken,
        'DELETE_PROPERTY',
        ownerUser.sub,
      );
      expect(prismaMock.property.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if a LOCADOR tries to delete without a token', async () => {
      const ownerUser = { sub: 'owner-id', role: UserRole.LOCADOR };

      (prismaMock.property.findUnique as jest.Mock).mockResolvedValue(
        mockProperty,
      );

      await expect(
        service.remove(propertyId, ownerUser as JwtPayload, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if the user is not the owner or an admin', async () => {
      const otherUser = { sub: 'other-user-id', role: UserRole.LOCADOR };

      (prismaMock.property.findUnique as jest.Mock).mockResolvedValue(
        mockProperty,
      );

      await expect(
        service.remove(propertyId, otherUser as JwtPayload, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException if property does not exist', async () => {
      const adminUser = { sub: 'admin-id', role: UserRole.ADMIN };

      (prismaMock.property.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.remove('non-existent-id', adminUser as JwtPayload, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
