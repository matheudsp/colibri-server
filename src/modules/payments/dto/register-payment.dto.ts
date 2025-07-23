import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class RegisterPaymentDto {
  @ApiProperty({
    description: 'The amount that was paid. If not provided, it defaults to the amountDue.',
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPaid?: number;
}