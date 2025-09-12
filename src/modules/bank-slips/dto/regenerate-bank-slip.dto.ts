import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegenerateBankSlipDto {
  @ApiProperty({
    description: 'ID da ordem de pagamento para o qual o boleto será gerado',
    example: 'clx123abc456def789',
  })
  @IsUUID()
  @IsNotEmpty()
  paymentOrderId: string;
}
