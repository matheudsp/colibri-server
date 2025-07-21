import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchUserDto } from './dto/search-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  private userSafeFields() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      cameraType: true,
    };
  }

  async findAll(params: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 10 } = params;

    const where: Prisma.UserWhereInput = {};
    if (status !== undefined) {
      if (status === 'true') where['status'] = true;
      else if (status === 'false') where['status'] = false;
    }

    try {
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          select: this.userSafeFields(),
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw new InternalServerErrorException('Erro ao buscar usuários');
    }
  }

  async search(filters: SearchUserDto) {
    const { name, email, role, status } = filters;

    const where = {};
    if (name) where['name'] = { contains: name, mode: 'insensitive' };
    if (email) where['email'] = { contains: email, mode: 'insensitive' };
    if (role) where['role'] = role;
    if (status !== undefined) where['status'] = status;

    return this.prisma.user.findMany({
      where,
      select: this.userSafeFields(),
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSafeFields(),
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.validateUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        ...(updateUserDto.role && { role: updateUserDto.role }),
      },
      select: this.userSafeFields(),
    });
  }

  async remove(id: string) {
    await this.validateUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { status: false },
      select: this.userSafeFields(),
    });
  }

  async restore(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: true },
      select: this.userSafeFields(),
    });
  }

  private async validateUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }
}
