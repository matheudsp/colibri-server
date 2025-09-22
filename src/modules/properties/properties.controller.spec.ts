import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { JwtPayload } from '../../common/interfaces/jwt.payload.interface';
import { UserRole } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';
import { CreatePropertyDto } from './dto/create-property.dto';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let propertiesServiceMock: DeepMockProxy<PropertiesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        { provide: PropertiesService, useValue: mockDeep<PropertiesService>() },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
    propertiesServiceMock = module.get(PropertiesService);
    mockReset(propertiesServiceMock);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call propertiesService.create with the correct parameters', async () => {
      const createDto: CreatePropertyDto = {
        title: 'New Property from Controller',
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
      const currentUser: JwtPayload = {
        sub: 'user-id',
        role: UserRole.LOCADOR,
        email: 'test@test.com',
        status: true,
        emailVerified: true,
        isTwoFactorEnabled: false,
      };
      const expectedResult = {
        id: 'property-1',
        ...createDto,
        landlordId: currentUser.sub,
      };

      propertiesServiceMock.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, currentUser);

      expect(result).toEqual(expectedResult);
      expect(propertiesServiceMock.create).toHaveBeenCalledWith(
        createDto,
        currentUser,
      );
      expect(propertiesServiceMock.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should call propertiesService.findOne and return the result', async () => {
      const propertyId = 'property-id-123';
      const expectedProperty = {
        id: propertyId,
        title: 'Test Property',
        landlordId: 'landlord-1',
      };

      propertiesServiceMock.findOne.mockResolvedValue(expectedProperty as any);

      const result = await controller.findOne(propertyId);

      expect(result).toEqual(expectedProperty);
      expect(propertiesServiceMock.findOne).toHaveBeenCalledWith(propertyId);
      expect(propertiesServiceMock.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should call propertiesService.remove with the correct parameters', async () => {
      const propertyId = 'prop-to-delete';
      const currentUser: JwtPayload = {
        sub: 'user-id',
        role: UserRole.LOCADOR,
        email: 'test@test.com',
        status: true,
        emailVerified: true,
        isTwoFactorEnabled: false,
      };
      const deleteDto = { actionToken: 'valid-token' };
      const expectedResponse = {
        message:
          'Imóvel e todos os dados associados foram removidos com sucesso.',
      };

      propertiesServiceMock.remove.mockResolvedValue(expectedResponse);

      const result = await controller.remove(
        propertyId,
        currentUser,
        deleteDto,
      );

      expect(result).toEqual(expectedResponse);
      expect(propertiesServiceMock.remove).toHaveBeenCalledWith(
        propertyId,
        currentUser,
        deleteDto,
      );
      expect(propertiesServiceMock.remove).toHaveBeenCalledTimes(1);
    });
  });
});
