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
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ContractStatus, GuaranteeType } from '@prisma/client';
import { Type } from 'class-transformer';

class ContractClauseDto {
  @IsUUID()
  @IsNotEmpty()
  clauseId: string;

  @IsNumber()
  @IsNotEmpty()
  order: number;
}

@ValidatorConstraint({ name: 'maxSecurityDeposit', async: false })
export class MaxSecurityDepositConstraint
  implements ValidatorConstraintInterface
{
  validate(securityDeposit: number, args: ValidationArguments) {
    const object = args.object as CreateContractDto;
    const rentAmount = object.rentAmount;

    // Se não houver valor de aluguel ou caução, a validação passa
    if (!rentAmount || !securityDeposit) {
      return true;
    }

    // O valor da caução não pode exceder 3x o valor do aluguel
    return securityDeposit <= rentAmount * 3;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as CreateContractDto;
    return `O valor do depósito caução não pode exceder 3 meses de aluguel (limite: R$ ${object.rentAmount * 3}).`;
  }
}

export function MaxSecurityDeposit(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: MaxSecurityDepositConstraint,
    });
  };
}
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
    description: 'CPF/CNPJ do locatário. Obrigatório se o usuário não existir.',
  })
  @IsString()
  @ValidateIf((o) => o.tenantPassword)
  @IsOptional()
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
  @ValidateIf((o) => o.guaranteeType === GuaranteeType.DEPOSITO_CAUCAO)
  @MaxSecurityDeposit({
    message: 'O valor do depósito caução não pode exceder 3 meses de aluguel.',
  })
  securityDeposit!: number;
}
