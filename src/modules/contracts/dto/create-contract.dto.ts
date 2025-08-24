import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsDateString,
  IsEmail,
  IsString,
  ValidateIf,
  MinLength,
} from 'class-validator';
import { ContractStatus, GuaranteeType } from '@prisma/client';

export class CreateContractDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  propertyId!: string;

  @ApiProperty({
    description: 'Email do locatário. Usado para buscar ou criar o usuário.',
  })
  @IsEmail()
  @ValidateIf((o) => o.tenantPassword)
  @IsNotEmpty()
  tenantEmail!: string;

  @ApiProperty({
    required: false,
    description: 'Nome do locatário. Obrigatório se o usuário não existir.',
  })
  @IsString()
  @ValidateIf((o) => o.tenantPassword) // Exige nome se uma senha for fornecida (indicando criação)
  @IsNotEmpty()
  tenantName!: string;

  @ApiProperty({
    required: false,
    description: 'CPF/CNPJ do locatário. Obrigatório se o usuário não existir.',
  })
  @IsString()
  @IsNotEmpty()
  tenantCpfCnpj!: string;

  @ApiProperty({
    required: false,
    description:
      'Senha para o novo locatário. Se não for fornecida, o sistema busca por um usuário existente.',
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  tenantPassword!: string;

  @ApiProperty({ enum: ContractStatus, required: false })
  @IsEnum(ContractStatus)
  @IsOptional()
  status!: ContractStatus;

  @ApiProperty({
    required: false,
    description: 'Telefone do locatário',
  })
  @IsString()
  @ValidateIf((o) => o.tenantPassword)
  @IsOptional()
  tenantPhone?: string;

  @ApiProperty() @IsNumber() @Min(0) rentAmount: number;
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  condoFee!: number;
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  iptuFee!: number;
  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty() @IsNumber() @Min(1) durationInMonths: number;

  @ApiProperty({ enum: GuaranteeType, required: false })
  @IsEnum(GuaranteeType)
  @IsOptional()
  guaranteeType!: GuaranteeType;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  securityDeposit!: number;
}
