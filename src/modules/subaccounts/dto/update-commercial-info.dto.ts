import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyType } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  ValidateIf,
  Length,
} from 'class-validator';

export class UpdateCommercialInfoDto {
  @ApiPropertyOptional({ description: 'Nome da empresa (se PJ)' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Faturamento/Renda mensal', example: 5000 })
  @IsNumber()
  @IsNotEmpty()
  incomeValue: number;

  @ApiProperty({ description: 'E-mail da conta' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ description: 'Telefone fixo' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Telefone Celular' })
  @IsString()
  @IsNotEmpty()
  mobilePhone: string;

  @ApiPropertyOptional({ description: 'Website' })
  @IsOptional()
  @IsString()
  site?: string;

  @ApiProperty({ description: 'CEP do endereço', example: '01001000' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 9)
  postalCode: string;

  @ApiProperty({ description: 'Logradouro', example: 'Praça da Sé' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Número do endereço', example: '100' })
  @IsString()
  @IsNotEmpty()
  addressNumber: string;

  @ApiPropertyOptional({ description: 'Complemento' })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ description: 'Bairro', example: 'Sé' })
  @IsString()
  @IsNotEmpty()
  province: string;
}
