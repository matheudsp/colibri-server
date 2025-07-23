import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, Length, IsNumber, Min } from 'class-validator';

export class SearchCondominiumDto {
  @Expose()
  @ApiProperty({ required: false, description: 'Filter by condominium name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @Expose()
  @ApiProperty({ required: false, description: 'Filter by state (e.g., SP)' })
  @IsOptional()
  @IsString()
  state?: string;

  @Expose()
  @ApiProperty({ required: false, description: 'Filter by city' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
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
}
