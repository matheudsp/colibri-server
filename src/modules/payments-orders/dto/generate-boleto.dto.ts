import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateBoletoDto {
  @ApiProperty({
    description: 'ID do contrato para o qual o boleto será gerado',
    example: 'clx123abc456def789',
  })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: 'Data de vencimento do boleto',
    example: '2025-12-01',
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;
}
