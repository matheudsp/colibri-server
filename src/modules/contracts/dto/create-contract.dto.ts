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
    description: 'CPF do locatário. Obrigatório se o usuário não existir.',
  })
  @IsString()
  @ValidateIf((o) => o.tenantPassword)
  @IsNotEmpty()
  tenantCpf!: string;

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
  @ApiProperty() @IsDateString() startDate: Date;
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
