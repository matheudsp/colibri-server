import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentsOrdersService } from './payments-orders.service';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { PaymentResponseDto } from './dto/response-payment.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { GeneratePaymentDto } from './dto/generate-payment.dto';

@Controller('payments')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Payments')
export class PaymentsOrdersController {
  constructor(private readonly paymentsService: PaymentsOrdersService) {}

  @Get('contracts/:contractId')
  @Roles(ROLES.LOCADOR, ROLES.LOCATARIO, ROLES.ADMIN)
  @ApiOperation({ summary: 'List all payments for a contract' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  findPaymentsByContract(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.findPaymentsByContract(contractId, currentUser);
  }

  // @Post('payments/:paymentId/pay')
  // @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  // @ApiOperation({ summary: 'Register a payment as paid' })
  // @ApiResponse({ status: 200, type: PaymentResponseDto })
  // registerPayment(
  //   @Param('paymentId', ParseUUIDPipe) paymentId: string,
  //   @CurrentUser() currentUser: JwtPayload,
  //   @Body() registerPaymentDto: RegisterPaymentDto,
  // ) {
  //   return this.paymentsService.registerPayment(
  //     paymentId,
  //     currentUser,
  //     registerPaymentDto,
  //   );
  // }

  @Post('generate')
  @ApiOperation({ summary: 'Gerar boleto para um contrato e data' })
  @ApiBody({ type: GeneratePaymentDto })
  async generateBoleto(@Body() generatePaymentDto: GeneratePaymentDto) {
    return this.paymentsService.generateMonthlyBoleto(generatePaymentDto);
  }

  // @Post('webhooks/asaas')
  // async handleAsaasWebhook(@Body() payload: any) {
  //   if (payload.event === 'PAYMENT_CONFIRMED') {
  //     const asaasId = payload.payment?.id;

  //     const boleto = await this.prisma.boleto.findUnique({
  //       where: { asaasBoletoId: asaasId },
  //       include: { payment: true },
  //     });

  //     if (!boleto) return;

  //     await this.prisma.payment.update({
  //       where: { id: boleto.paymentId },
  //       data: {
  //         status: 'CONFIRMADO',
  //         paidAt: new Date(payload.payment?.paymentDate),
  //         amountPaid: Number(payload.payment?.value),
  //       },
  //     });
  //   }
  // }
}
