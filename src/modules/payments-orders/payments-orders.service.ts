import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentStatus, type Prisma } from '@prisma/client';

import { addMonths } from 'date-fns';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsOrdersService {
  constructor(
    private prisma: PrismaService,
    private logHelper: LogHelperService,
  ) {}

  async findPaymentsByContract(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado.');
    }

    if (
      contract.tenantId !== currentUser.sub &&
      contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar os pagamentos deste contrato.',
      );
    }

    return this.prisma.paymentOrder.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createPaymentsForContract(contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(
        'Contrato não encontrado para gerar ordens de pagamento.',
      );
    }

    const existingPayments = await this.prisma.paymentOrder.count({
      where: { contractId },
    });

    if (existingPayments > 0) {
      console.log(
        `Pagamentos para o contrato ${contractId} já existem. Nenhuma ação foi tomada.`,
      );
      return;
    }

    const paymentsToCreate: Prisma.PaymentOrderCreateManyInput[] = [];
    const totalAmount =
      contract.rentAmount.toNumber() +
      (contract.condoFee?.toNumber() ?? 0) +
      (contract.iptuFee?.toNumber() ?? 0);

    for (let i = 0; i < contract.durationInMonths; i++) {
      const dueDate = addMonths(contract.startDate, i + 1);
      paymentsToCreate.push({
        contractId: contract.id,
        dueDate: dueDate,
        amountDue: totalAmount,
        status: 'PENDENTE',
      });
    }

    if (paymentsToCreate.length > 0) {
      await this.prisma.paymentOrder.createMany({
        data: paymentsToCreate,
      });
    }
  }
}
