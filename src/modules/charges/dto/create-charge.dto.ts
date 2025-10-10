import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateChargeDto {
  @ApiProperty({
    description: 'ID da ordem de pagamento para a qual a cobrança será gerada.',
  })
  @IsUUID()
  @IsNotEmpty()
  paymentOrderId: string;

  @ApiProperty({
    description: 'O tipo de cobrança a ser gerada.',
    enum: ['BOLETO', 'PIX'],
    default: 'BOLETO',
  })
  @IsEnum(['BOLETO', 'PIX'])
  @IsOptional()
  billingType: 'BOLETO' | 'PIX' = 'BOLETO';
}
