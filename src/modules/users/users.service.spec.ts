import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';
import { UserService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { VerificationService } from '../verification/verification.service';
import { LogHelperService } from '../logs/log-helper.service';
import { getQueueToken } from '@nestjs/bull';

describe('UserService', () => {
  let service: UserService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let verificationServiceMock: DeepMockProxy<VerificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: LogHelperService, useValue: mockDeep<LogHelperService>() },
        {
          provide: VerificationService,
          useValue: mockDeep<VerificationService>(),
        },
        { provide: getQueueToken('email'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaMock = module.get(PrismaService);
    verificationServiceMock = module.get(VerificationService);

    mockReset(prismaMock);
    mockReset(verificationServiceMock);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a user object when a valid ID is provided', async () => {
      const mockUser: Partial<User> = { id: 'user-1', name: 'Test User' };
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.findOne('user-1')).resolves.toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
    });

    it('should throw a NotFoundException if the user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const userId = 'user-to-update';
    // Usamos Partial<User> para o mock, incluindo os campos que o service realmente usa na lógica.
    const mockUser: Partial<User> = {
      id: userId,
      name: 'Original Name',
      role: UserRole.LOCATARIO,
    };
    const updateDto = { name: 'New Name', actionToken: 'valid-token' };

    it('should throw ForbiddenException when a user tries to update another user', async () => {
      const currentUser = { sub: 'different-user', role: UserRole.LOCATARIO };

      await expect(
        service.update(userId, updateDto, currentUser as JwtPayload),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow an admin to update any user without an actionToken', async () => {
      const adminPayload = { sub: 'admin-id', role: UserRole.ADMIN };
      const adminUpdateDto = { name: 'Updated by Admin' };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        ...adminUpdateDto,
      });

      await service.update(userId, adminUpdateDto, adminPayload as JwtPayload);

      expect(verificationServiceMock.consumeActionToken).not.toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: 'Updated by Admin' },
        select: expect.any(Object),
      });
    });

    it('should require an actionToken for non-admin users', async () => {
      const regularUserPayload = { sub: userId, role: UserRole.LOCATARIO };
      const dtoWithoutToken = { name: 'New Name' };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.update(
          userId,
          dtoWithoutToken,
          regularUserPayload as JwtPayload,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update the user when token is valid and user is owner', async () => {
      const regularUserPayload = { sub: userId, role: UserRole.LOCATARIO };

      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaMock.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        name: updateDto.name,
      });
      (
        verificationServiceMock.consumeActionToken as jest.Mock
      ).mockResolvedValue(undefined);

      await service.update(userId, updateDto, regularUserPayload as JwtPayload);

      expect(verificationServiceMock.consumeActionToken).toHaveBeenCalledWith(
        updateDto.actionToken,
        'UPDATE_USER_PROFILE',
        userId,
      );
      expect(prismaMock.user.update).toHaveBeenCalled();
    });
  });
});
