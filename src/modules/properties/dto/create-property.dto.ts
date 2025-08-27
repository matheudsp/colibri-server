import { ApiProperty } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';
import { Expose } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
  Length,
  IsEnum,
} from 'class-validator';

export class CreatePropertyDto {
  @Expose()
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @Expose()
  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  @IsNotEmpty()
  propertyType: PropertyType;

  @Expose() @ApiProperty() @IsString() @IsOptional() description?: string;
  @Expose() @ApiProperty() @IsString() @IsNotEmpty() @Length(8, 8) cep: string;
  @Expose() @ApiProperty() @IsString() @IsNotEmpty() street: string;
  @Expose() @ApiProperty() @IsString() @IsNotEmpty() number: string;
  @Expose() @ApiProperty() @IsString() @IsOptional() complement?: string;
  @Expose() @ApiProperty() @IsString() @IsNotEmpty() district: string;
  @Expose() @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @Expose()
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  state: string;
  @Expose() @ApiProperty() @IsNumber() @Min(1) areaInM2: number;
  @Expose() @ApiProperty() @IsNumber() @Min(0) numRooms: number;
  @Expose() @ApiProperty() @IsNumber() @Min(0) numBathrooms: number;
  @Expose() @ApiProperty() @IsNumber() @Min(0) numParking: number;
  @Expose() @ApiProperty() @IsBoolean() @IsOptional() isAvailable?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  rentValue!: number;
  // @Expose()
  // @ApiProperty()
  // photos!: Express.Multer.File[];
}
