import { ApiProperty } from '@nestjs/swagger';
import { CompanyType } from '@prisma/client';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  ValidateIf,
} from 'class-validator';

export class CreateLandlordDto {
  @ApiProperty({ example: 'João da Silva Locador' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'landlord@colibri.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '11999998888' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  cpfCnpj!: string;

  @ApiProperty({ example: '01001000' })
  @IsString()
  @IsNotEmpty()
  cep: string;

  @ApiProperty({ example: 'Praça da Sé' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: '100' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ example: 'Sé' })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ required: false, example: 'lado ímpar' })
  @IsString()
  @IsOptional()
  complement?: string;

  @ApiProperty({
    description: 'Renda/Faturamento mensal.',
    example: 5000,
  })
  @IsNumber()
  @IsOptional()
  incomeValue?: number;

  @ApiProperty({
    description: 'Obrigatório se for Pessoa Jurídica.',
    enum: CompanyType,
    required: false,
    example: CompanyType.MEI,
  })
  @ValidateIf((obj) => obj.cpfCnpj?.length > 11)
  @IsEnum(CompanyType)
  @IsNotEmpty()
  companyType?: CompanyType;

  // Requerido se CPF (pessoa física)
  @ApiProperty({
    description: 'Data de nascimento. Obrigatório se for Pessoa Física.',
    example: '1990-01-15',
    required: false,
  })
  @ValidateIf((obj) => obj.cpfCnpj?.length === 11)
  @IsDateString()
  @IsNotEmpty()
  birthDate?: string;
}
