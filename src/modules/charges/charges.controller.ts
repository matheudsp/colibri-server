import {
  Body,
  Get,
  Controller,
  Param,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ChargesService } from './charges.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { Roles } from 'src/common/decorator/roles.decorator';
import type { RegenerateChargeDto } from './dto/regenerate-charge.dto';
import type { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';

@Controller('charges')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Charges')
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Gera uma cobrança (Boleto ou PIX) para uma ordem de pagamento',
  })
  @Roles(ROLES.ADMIN, ROLES.LOCATARIO, ROLES.LOCADOR)
  @ApiBody({ type: CreateChargeDto })
  async generateBankSlip(@Body() generateDto: CreateChargeDto) {
    return this.chargesService.generateChargeForPaymentOrder(
      generateDto.paymentOrderId,
      generateDto.billingType,
    );
  }

  @Get(':paymentOrderId/pix')
  @ApiOperation({
    summary: 'Obtém os dados do QR Code PIX para uma cobrança existente',
    description:
      'Busca os dados do PIX diretamente no gateway de pagamento. Não armazena os dados.',
  })
  @Roles(ROLES.ADMIN, ROLES.LOCATARIO, ROLES.LOCADOR)
  async getPixData(@Param('paymentOrderId') paymentOrderId: string) {
    return this.chargesService.getPixQrCodeForCharge(paymentOrderId);
  }

  @Get(':paymentOrderId/identificationField')
  @ApiOperation({
    summary: 'Obtém a linha digitável de um boleto para uma cobrança existente',
  })
  @Roles(ROLES.ADMIN, ROLES.LOCATARIO, ROLES.LOCADOR)
  async getBoletoIdentificationField(
    @Param('paymentOrderId') paymentOrderId: string,
  ) {
    return this.chargesService.getBankSlipIdentificationField(paymentOrderId);
  }

  @Post(':paymentOrderId/regenerate-deposit-charge')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({
    summary:
      '[Ação do Locador] Gera uma nova cobrança para um depósito caução vencido',
  })
  @ApiResponse({
    status: 200,
    description: 'Nova cobrança gerada e locatário notificado.',
  })
  regenerateDepositCharge(
    @Param('paymentOrderId', ParseUUIDPipe) paymentOrderId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.chargesService.regenerateDepositCharge(
      paymentOrderId,
      currentUser,
    );
  }
}
