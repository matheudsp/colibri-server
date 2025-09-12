import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { GenerateBankSlipDto } from './dto/generate-bank-slip.dto';
import { BankSlipsService } from './bank-slips.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { Roles } from 'src/common/decorator/roles.decorator';
import type { RegenerateBankSlipDto } from './dto/regenerate-bank-slip.dto';

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
  @Post(':paymentOrderId/regenerate')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN, ROLES.LOCATARIO)
  @ApiOperation({
    summary: 'Gerar um novo boleto atualizado para uma fatura ATRASADA',
  })
  async regenerateOverdueBankSlip(
    @Body() regenerateDto: RegenerateBankSlipDto,
  ) {
    return this.bankSlipsService.regenerateOverdueBankSlip(
      regenerateDto.paymentOrderId,
    );
  }
}
