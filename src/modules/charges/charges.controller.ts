import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ChargesService } from './charges.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { Roles } from 'src/common/decorator/roles.decorator';
import type { RegenerateChargeDto } from './dto/regenerate-charge.dto';

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
}
