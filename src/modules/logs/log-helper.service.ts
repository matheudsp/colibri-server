import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogHelperService {
  constructor(private prisma: PrismaService) {}

  async createLog(
    userId: string,
    action: string,
    tableName: string,
    targetId: string,
  ) {
    await this.prisma.log.create({
      data: {
        userId,
        action,
        tableName,
        targetId,
        createdAt: new Date(),
      },
    });
  }
}
