import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
  Length,
} from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @ApiProperty() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(8, 8) cep: string;
  @ApiProperty() @IsString() @IsNotEmpty() street: string;
  @ApiProperty() @IsString() @IsNotEmpty() number: string;
  @ApiProperty() @IsString() @IsOptional() complement?: string;
  @ApiProperty() @IsString() @IsNotEmpty() district: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() @Length(2, 2) state: string;
  @ApiProperty() @IsNumber() @Min(1) areaInM2: number;
  @ApiProperty() @IsNumber() @Min(0) numRooms: number;
  @ApiProperty() @IsNumber() @Min(0) numBathrooms: number;
  @ApiProperty() @IsNumber() @Min(0) numParking: number;
  @ApiProperty() @IsBoolean() @IsOptional() isAvailable?: boolean;
}
