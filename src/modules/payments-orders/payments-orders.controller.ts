import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Put,
  Patch,
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
import type { RegisterPaymentDto } from './dto/register-payment.dto';

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

  @Patch(':paymentId')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'Registra um pagamento manualmente (dar baixa)' })
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  registerPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() registerPaymentDto: RegisterPaymentDto,
  ) {
    return this.paymentsService.registerPayment(
      paymentId,
      currentUser,
      registerPaymentDto,
    );
  }
}
