import { ApiProperty } from '@nestjs/swagger';
import { BankAccountType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({
    description: 'Código ou nome do banco (Ex: "001" para Banco do Brasil)',
    example: '290',
  })
  @IsString()
  @IsNotEmpty()
  bank: string;

  @ApiProperty({
    description: 'Número da agência, sem o dígito verificador',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty()
  agency: string;

  @ApiProperty({
    description: 'Número da conta, incluindo o dígito verificador',
    example: '12345-6',
  })
  @IsString()
  @IsNotEmpty()
  account: string;

  @ApiProperty({
    description: 'Tipo de conta bancária',
    enum: BankAccountType,
    example: BankAccountType.CONTA_CORRENTE,
  })
  @IsEnum(BankAccountType)
  @IsNotEmpty()
  accountType: BankAccountType;

}