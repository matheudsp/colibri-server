import { Injectable } from '@nestjs/common';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  eachMonthOfInterval,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
const getDateRangeFromPeriod = (period?: string) => {
  const now = new Date();
  switch (period) {
    case 'this_year':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
    case 'last_year':
      const lastYear = subYears(now, 1);
      return {
        startDate: startOfYear(lastYear),
        endDate: endOfYear(lastYear),
      };
    case 'last_6_months':
    default:
      return {
        startDate: startOfMonth(subMonths(now, 5)),
        endDate: endOfMonth(now),
      };
  }
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRentIncome(currentUser: JwtPayload, period?: string) {
    const { startDate, endDate } = getDateRangeFromPeriod(period);

    const results: { month: Date; amount: bigint }[] = await this.prisma
      .$queryRaw`
        SELECT
          DATE_TRUNC('month', "paidAt") as month,
          SUM("amountPaid") as amount
        FROM
          "PaymentOrder"
        WHERE
          "contractId" IN (
            SELECT id FROM "Contract" WHERE "landlordId" = ${currentUser.sub}
          )
          AND "status" = 'PAGO'
          AND "paidAt" >= ${startDate}
          AND "paidAt" <= ${endDate}
        GROUP BY
          month
        ORDER BY
          month ASC;
      `;

    const incomeMap = new Map<string, number>();
    results.forEach((row) => {
      const monthKey = format(new Date(row.month), 'yyyy-MM');

      incomeMap.set(monthKey, Number(row.amount));
    });

    const allMonthsInInterval = eachMonthOfInterval({
      start: startDate,
      end: endDate,
    });

    const monthlyIncome = allMonthsInInterval.map((monthDate) => {
      const monthKey = format(monthDate, 'yyyy-MM');
      return {
        month: format(monthDate, 'MMM', { locale: ptBR }), // Formato 'jan', 'fev', etc.
        amount: incomeMap.get(monthKey) || 0,
      };
    });

    return {
      year: startDate.getFullYear(), // Retorna o ano de início do período
      monthlyIncome,
    };
  }

  async getTenantsStatus(currentUser: JwtPayload) {
    const contracts = await this.prisma.contract.findMany({
      where: {
        landlordId: currentUser.sub,
        status: 'ATIVO',
      },
      include: {
        paymentsOrders: {
          where: {
            status: 'ATRASADO', // Analisa todos pagamentos atrasados do contrato
          },
        },
      },
    });

    let goodPayer = 0;
    let late = 0;
    let defaulted = 0;

    contracts.forEach((contract) => {
      const latePaymentsCount = contract.paymentsOrders.length;

      if (latePaymentsCount > 1) {
        defaulted++;
      } else if (latePaymentsCount === 1) {
        late++;
      } else {
        goodPayer++;
      }
    });

    return {
      totalTenants: contracts.length,
      status: {
        goodPayer,
        late,
        defaulted,
      },
    };
  }

  async getPaymentsSummary(currentUser: JwtPayload, period?: string) {
    const { startDate, endDate } = getDateRangeFromPeriod(period);

    const received = await this.prisma.paymentOrder.aggregate({
      _sum: { amountPaid: true },
      where: {
        status: 'PAGO',
        paidAt: { gte: startDate, lte: endDate },
        contract: { landlordId: currentUser.sub },
      },
    });

    const pending = await this.prisma.paymentOrder.aggregate({
      _sum: { amountDue: true },
      where: {
        status: { in: ['PENDENTE', 'ATRASADO'] },
        dueDate: { gte: startDate, lte: endDate },
        contract: { landlordId: currentUser.sub },
      },
    });

    return {
      period: period || 'last_6_months',
      received: received._sum.amountPaid?.toNumber() || 0,
      pending: pending._sum.amountDue?.toNumber() || 0,
    };
  }

  async getPropertiesOccupancy(currentUser: JwtPayload) {
    const properties = await this.prisma.property.groupBy({
      by: ['propertyType'],
      _count: {
        id: true,
      },
      where: {
        landlordId: currentUser.sub,
      },
    });

    const occupiedProperties = await this.prisma.property.groupBy({
      by: ['propertyType'],
      _count: {
        id: true,
      },
      where: {
        landlordId: currentUser.sub,
        isAvailable: false,
      },
    });

    const occupancyData = properties.map((p) => {
      const occupied =
        occupiedProperties.find((o) => o.propertyType === p.propertyType)
          ?._count.id || 0;
      return {
        type: p.propertyType,
        total: p._count.id,
        occupied,
      };
    });

    return {
      types: occupancyData,
    };
  }
}
