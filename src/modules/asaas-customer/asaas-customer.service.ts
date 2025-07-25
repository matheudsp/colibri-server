import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { CreateAsaasCustomerDto } from './dto/create-asaas-customer.dto';

@Injectable()
export class AsaasCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  async getOrCreate(userId: string, subaccountId: string): Promise<string> {
    const [user, subaccount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.subAccount.findUnique({ where: { id: subaccountId } }),
    ]);

    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!subaccount) throw new NotFoundException('Subconta não encontrada.');

    const existing = await this.prisma.asaasCustomer.findUnique({
      where: {
        tenantId_subaccountId: {
          tenantId: userId,
          subaccountId: subaccountId,
        },
      },
    });

    if (existing) return existing.asaasCustomerId;

    const dto: CreateAsaasCustomerDto = {
      name: user.name,
      cpfCnpj: user.cpfCnpj,
      email: user.email,
      phone: user.phone!,
    };

    const gatewayCustomer = await this.paymentGatewayService.createCustomer(
      subaccount.apiKey,
      dto,
    );

    await this.prisma.asaasCustomer.create({
      data: {
        tenantId: userId,
        subaccountId: subaccountId,
        asaasCustomerId: gatewayCustomer.id,
      },
    });

    return gatewayCustomer.id;
  }
}
