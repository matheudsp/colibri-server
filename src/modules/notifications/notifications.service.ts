import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType, NotificationJob } from 'src/queue/jobs/email.job';
import { User } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

export interface NotificationAction {
  text: string;
  path: string;
}

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  action?: NotificationAction;
  sendEmail?: boolean;
  user: Pick<User, 'name' | 'email'>; // Dados do usuário para o e-mail
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  /**
   * Cria uma notificação no banco de dados e, opcionalmente, enfileira um e-mail.
   */
  async create(dto: CreateNotificationDto) {
    const { userId, title, message, action, sendEmail, user } = dto;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        actionUrl: action?.path,
      },
    });

    if (sendEmail) {
      const emailJob: NotificationJob = {
        user: { name: user.name, email: user.email },
        notification: { title, message },
        action: action,
      };
      await this.emailQueue.add(EmailJobType.NOTIFICATION, emailJob);
    }

    this.notificationsGateway.sendNotificationToUser(userId, notification);

    return notification;
  }

  async findByUser(userId: string) {
    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return { notifications, unreadCount: unreadCount };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(
        'Notificação não encontrada ou não pertence ao usuário.',
      );
    }
    if (notification.read) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    if (unreadCount === 0) {
      return {
        affectedRows: 0,
        message: 'Nenhuma notificação nova para marcar como lida.',
      };
    }
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { affectedRows: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unreadCount: count };
  }
}
