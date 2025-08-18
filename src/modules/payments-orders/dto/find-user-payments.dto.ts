import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { Expose } from 'class-transformer';

export class FindUserPaymentsDto {
  @Expose()
  @ApiPropertyOptional({
    description: 'Filter payments by a specific property ID.',
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Filter payments by status.',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
