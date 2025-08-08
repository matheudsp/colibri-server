import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePhotoDto {
  @Expose()
  @ApiProperty()
  @IsUUID()
  propertyId!: string;

  @Expose()
  @ApiProperty()
  @IsString()
  filePath!: string;

  @Expose()
  @ApiProperty()
  @IsBoolean()
  isCover!: boolean | undefined;

  @Expose()
  @ApiProperty()
  @IsOptional()
  @IsString()
  name?: string;
}
