import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { GenerateBankSlipDto } from './dto/generate-bank-slip.dto';
import { BankSlipsService } from './bank-slips.service';

@Controller('bank-slips')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Bank-slips')
export class BankSlipsController {
  constructor(private readonly bankSlipsService: BankSlipsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Gerar boleto para um contrato' })
  @ApiBody({ type: GenerateBankSlipDto })
  async generateBankSlip(@Body() generateDto: GenerateBankSlipDto) {
    return this.bankSlipsService.generateBankSlipForPaymentOrder(
      generateDto.paymentOrderId,
    );
  }
}
