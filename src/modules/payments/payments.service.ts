import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogHelperService } from '../logs/log-helper.service';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentStatus } from '@prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logHelper: LogHelperService,
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

    return this.prisma.payment.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async registerPayment(
    paymentId: string,
    currentUser: JwtPayload,
    registerPaymentDto: RegisterPaymentDto,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { contract: true },
    });

    if (!payment || !payment.contract) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    if (
      payment.contract.landlordId !== currentUser.sub &&
      currentUser.role !== ROLES.ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas o locador ou um administrador podem registrar um pagamento.',
      );
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAGO,
        paidAt: new Date(),
        amountPaid: registerPaymentDto.amountPaid ?? payment.amountDue,
      },
    });

    await this.logHelper.createLog(
      currentUser.sub,
      'REGISTER_PAYMENT',
      'Payment',
      paymentId,
    );

    return updatedPayment;
  }
}
