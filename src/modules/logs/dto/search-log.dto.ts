import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class SearchLogDto {
  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  action?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tableName?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
