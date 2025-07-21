import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchLogDto } from './dto/search-log.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LogService {
  constructor(private prisma: PrismaService) {}

  async findAll({ page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;
    return this.prisma.log.findMany({
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async search(searchLogDto: SearchLogDto) {
    const { action, tableName, startDate, endDate } = searchLogDto;

    const where: Prisma.LogWhereInput = {};

    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (tableName)
      where.tableName = { contains: tableName, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      };
    }

    return this.prisma.log.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.log.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
