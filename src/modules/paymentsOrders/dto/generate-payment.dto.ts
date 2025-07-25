import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GeneratePaymentDto {
  @ApiProperty({
    description: 'ID do contrato para o qual o boleto será gerado',
    example: 'clx123abc456def789',
  })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: 'Data de vencimento do boleto (formato ISO)',
    example: '2025-08-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
