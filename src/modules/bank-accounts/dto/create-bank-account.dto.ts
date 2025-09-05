import { ApiProperty } from '@nestjs/swagger';
import { PixAddressKeyType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({
    description: 'Tipo da chave PIX.',
    enum: PixAddressKeyType,
    example: PixAddressKeyType.CPF,
  })
  @IsEnum(PixAddressKeyType)
  @IsNotEmpty()
  pixAddressKeyType: PixAddressKeyType;

  @ApiProperty({
    description:
      'A chave PIX do locador (CPF/CNPJ sem formatação, e-mail, telefone no padrão E.164 ou chave aleatória UUID).',
    example: '09493012301',
  })
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o) => o.pixAddressKeyType === PixAddressKeyType.CPF)
  @Matches(/^\d{11}$/, {
    message: 'A chave PIX do tipo CPF deve conter 11 dígitos, sem formatação.',
  })
  @ValidateIf((o) => o.pixAddressKeyType === PixAddressKeyType.CNPJ)
  @Matches(/^\d{14}$/, {
    message: 'A chave PIX do tipo CNPJ deve conter 14 dígitos, sem formatação.',
  })
  @ValidateIf((o) => o.pixAddressKeyType === PixAddressKeyType.EMAIL)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Formato de e-mail inválido para chave PIX.',
  })
  @ValidateIf((o) => o.pixAddressKeyType === PixAddressKeyType.PHONE)
  @Matches(/^\+[1-9][0-9]\d{1,14}$/, {
    message:
      'A chave PIX de telefone deve seguir o padrão E.164 (ex: +5511999998888).',
  })
  @ValidateIf((o) => o.pixAddressKeyType === PixAddressKeyType.EVP)
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'A chave aleatória (EVP) deve ter o formato de um UUID.',
  })
  pixAddressKey: string;
}
