import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';

import { QueueName } from 'src/queue/jobs/jobs';
import { EmailJobType, NotificationJob } from 'src/queue/jobs/email.job';
import { CreateInterestDto } from './dto/create-interest.dto';
import { UpdateInterestStatusDto } from './dto/update-interest-status.dto';
import { InterestStatus } from '@prisma/client';
import { UserPreferences } from 'src/common/interfaces/user.preferences.interface';

@Injectable()
export class InterestsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.EMAIL) private readonly emailQueue: Queue,
  ) {}

  /**
   * Verifica se o usuário atual já demonstrou interesse em um imóvel.
   * Retorna um booleano para indicar o status.
   */
  async checkInterest(propertyId: string, currentUser: JwtPayload) {
    const interest = await this.prisma.interest.findFirst({
      where: {
        propertyId: propertyId,
        tenantId: currentUser.sub,
      },
      select: {
        id: true,
      },
    });

    return { hasInterested: !!interest };
  }

  async create(dto: CreateInterestDto, currentUser: JwtPayload) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { landlord: true },
    });

    if (!property || !property.landlord) {
      throw new NotFoundException('Imóvel não encontrado.');
    }

    const existingInterest = await this.prisma.interest.findFirst({
      where: {
        tenantId: currentUser.sub,
        propertyId: dto.propertyId,
      },
    });

    if (existingInterest) {
      throw new ConflictException('Você já demonstrou interesse neste imóvel.');
    }

    if (property.landlordId === currentUser.sub) {
      throw new BadRequestException(
        'Você não pode manifestar interesse no seu próprio imóvel.',
      );
    }

    const landlordPreferences =
      (property.landlord.preferences as UserPreferences) || {};
    if (landlordPreferences.notifications?.acceptOnlineProposals !== true) {
      throw new ForbiddenException(
        'Este locador não aceita manifestações de interesse online no momento.',
      );
    }

    const newInterest = await this.prisma.interest.create({
      data: {
        propertyId: dto.propertyId,
        message: dto.message,
        tenantId: currentUser.sub,
        landlordId: property.landlordId,
      },
    });

    const job: NotificationJob = {
      user: { name: property.landlord.name, email: property.landlord.email },
      notification: {
        title: `Você tem um novo interessado no imóvel ${property.title}!`,
        message: `O usuário ${currentUser.email} manifestou interesse no seu imóvel. Acesse a plataforma para ver os detalhes e iniciar o contato.`,
      },
      action: {
        text: 'Ver Interesses Recebidos',
        path: '/interesses/recebidos',
      },
    };
    await this.emailQueue.add(EmailJobType.NOTIFICATION, job);

    return { message: 'Interesse enviado com sucesso!', data: newInterest };
  }

  async findReceived(currentUser: JwtPayload) {
    return this.prisma.interest.findMany({
      where: { landlordId: currentUser.sub },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cpfCnpj: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSent(currentUser: JwtPayload) {
    return this.prisma.interest.findMany({
      where: { tenantId: currentUser.sub },
      include: {
        landlord: { select: { name: true } },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    interestId: string,
    dto: UpdateInterestStatusDto,
    currentUser: JwtPayload,
  ) {
    const interest = await this.prisma.interest.findUnique({
      where: { id: interestId },
      include: { tenant: true, property: true },
    });

    if (!interest) {
      throw new NotFoundException('Interesse não encontrado.');
    }
    if (interest.landlordId !== currentUser.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar o status deste interesse.',
      );
    }
    if (interest.status !== InterestStatus.PENDING) {
      throw new BadRequestException(
        `Este interesse já foi atualizado para o status: ${interest.status}.`,
      );
    }

    const updatedInterest = await this.prisma.interest.update({
      where: { id: interestId },
      data: {
        status: dto.status,
        // Salva o motivo da dispensa apenas se o status for DISMISSED
        dismissalReason:
          dto.status === InterestStatus.DISMISSED ? dto.dismissalReason : null,
      },
    });
    let notificationTitle = '';
    let notificationMessage = '';

    if (dto.status === InterestStatus.CONTACTED) {
      notificationTitle = `Boas notícias sobre o imóvel ${interest.property.title}!`;
      notificationMessage = `O locador visualizou seu interesse e poderá entrar em contato com você em breve.`;
    } else if (dto.status === InterestStatus.DISMISSED) {
      notificationTitle = `Atualização sobre seu interesse no imóvel ${interest.property.title}`;
      notificationMessage = `O locador analisou seu interesse, mas não poderá seguir com o contato no momento.\nMotivo: "${dto.dismissalReason}"`;
    }

    if (notificationTitle) {
      const job: NotificationJob = {
        user: { name: interest.tenant.name, email: interest.tenant.email },
        notification: {
          title: notificationTitle,
          message: notificationMessage,
        },
        action: { text: 'Ver Meus Interesses', path: '/interesses/enviados' },
      };
      await this.emailQueue.add(EmailJobType.NOTIFICATION, job);
    }

    return updatedInterest;
  }
}
