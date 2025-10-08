import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { SubaccountsService } from './subaccounts.service';

@Injectable()
export class SubaccountsAdminService {
  private readonly logger = new Logger(SubaccountsAdminService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly logHelper: LogHelperService,
    private readonly subaccountsService: SubaccountsService,
  ) {}

  async findPendingApproval() {
    return this.prisma.subAccount.findMany({
      where: { statusGeneral: 'PENDING_ADMIN_APPROVAL' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async approveSubaccount(subaccountId: string, adminUser: JwtPayload) {
    this.logger.log(
      `Admin ${adminUser.sub} está aprovando a subconta ${subaccountId}.`,
    );

    const subAccountRequest = await this.prisma.subAccount.findUnique({
      where: { id: subaccountId },
      include: { user: true },
    });

    if (!subAccountRequest || !subAccountRequest.user) {
      throw new NotFoundException('Solicitação de subconta não encontrada.');
    }

    if (subAccountRequest.statusGeneral !== 'PENDING_ADMIN_APPROVAL') {
      throw new BadRequestException(
        `Esta solicitação não está pendente de aprovação (status atual: ${subAccountRequest.statusGeneral}).`,
      );
    }

    const createdSubAccount =
      await this.subaccountsService.completeSubaccountCreation(
        subAccountRequest.user,
      );

    await this.logHelper.createLog(
      adminUser.sub,
      'APPROVE_SUBACCOUNT',
      'SubAccount',
      createdSubAccount.id,
    );

    await this.notificationsService.create({
      userId: subAccountRequest.user.id,
      user: subAccountRequest.user,
      title: 'Sua solicitação de conta foi aprovada!',
      message: `Olá, ${subAccountRequest.user.name}. Sua solicitação para criar uma conta de recebimentos foi aprovada. Estamos processando a criação no serviço de pagamentos e em breve você receberá as instruções para os próximos passos.`,
      action: {
        text: 'Ver Minha Conta',
        path: '/conta?aba=conta-de-pagamentos',
      },
      sendEmail: true,
    });

    return {
      message:
        'Subconta aprovada com sucesso. O processo de criação foi iniciado.',
    };
  }
}
