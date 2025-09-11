import { ApiProperty } from '@nestjs/swagger';
import { PropertyTransactionType, PropertyType } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  IsNumber,
  Min,
  IsEnum,
  IsIn,
} from 'class-validator';

export class SearchPropertyDto {
  @Expose()
  @ApiProperty({
    required: false,
    description:
      'Termo de busca genérico para título, rua, bairro, cidade, estado ou CEP.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @Expose()
  @ApiProperty({ enum: PropertyType, required: false })
  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @ApiProperty({ enum: PropertyTransactionType, required: false })
  @IsEnum(PropertyTransactionType)
  @IsOptional()
  transactionType?: PropertyTransactionType;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'Cidade deve ter entre 2 e 100 caracteres' })
  city?: string;

  @Expose()
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @Expose()
  @ApiProperty({ required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @Expose()
  @ApiProperty({
    required: false,
    description: 'Critério de ordenação dos resultados.',
    enum: [
      'createdAt:desc',
      'price:asc',
      'price:desc',
      'size:asc',
      'size:desc',
    ],
    default: 'createdAt:desc',
  })
  @IsOptional()
  @IsIn(['createdAt:desc', 'price:asc', 'price:desc', 'size:asc', 'size:desc'])
  sort?: string;
}
