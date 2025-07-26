import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { GenerateBoletoDto } from './dto/generate-boleto.dto';
import { BankSlipsService } from './bank-slips.service';

@Controller('boletos')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Boletos')
export class BankSlipsController {
  constructor(private readonly bankSlipsService: BankSlipsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Gerar boleto para um contrato' })
  @ApiBody({ type: GenerateBoletoDto })
  async generateBoleto(@Body() paymentOrderId: string) {
    return this.bankSlipsService.generateForPaymentOrder(paymentOrderId);
  }
}
