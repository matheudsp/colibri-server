import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterPaymentDto {
  @ApiProperty({
    description:
      'O valor que foi pago. Se não for informado, assume o valor total devido (amountDue).',
    required: false,
    example: 1500.5,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;

  @ApiProperty({
    description:
      'A data em que o pagamento foi efetuado. Se não for informada, assume a data atual.',
    required: false,
    example: '2025-07-30',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  paidAt?: Date;
}
