import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { GenerateBoletoDto } from './dto/generate-boleto.dto';
import { BoletosService } from './boletos.service';

@Controller('boletos')
@RequireAuth()
@ApiBearerAuth()
@ApiTags('Boletos')
export class BoletosController {
  constructor(private readonly boletosService: BoletosService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Gerar boleto para um contrato' })
  @ApiBody({ type: GenerateBoletoDto })
  async generateBoleto(@Body() paymentOrderId: string) {
    return this.boletosService.generateForPaymentOrder(paymentOrderId);
  }
}
