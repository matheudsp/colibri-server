import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
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

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Filter payments by status.',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Data de início para o filtro de período (formato: AAAA-MM-DD).',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Data de fim para o filtro de período (formato: AAAA-MM-DD).',
    example: '2025-03-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
