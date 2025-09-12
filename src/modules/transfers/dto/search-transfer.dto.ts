import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum TransferType {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

export class SearchTransferDto {
  @ApiPropertyOptional({
    description: 'Número da página para paginação.',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Número de itens por página.',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Filtra as transferências por tipo: repasses automáticos ou saques manuais.',
    enum: TransferType,
  })
  @IsOptional()
  @IsEnum(TransferType)
  type?: TransferType;
}
