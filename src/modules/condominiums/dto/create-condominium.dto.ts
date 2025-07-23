import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCondominiumDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  cep: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  street: string;
  
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  state: string;
}