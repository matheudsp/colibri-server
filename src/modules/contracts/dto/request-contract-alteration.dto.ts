import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestContractAlterationDto {
  @ApiProperty({
    description:
      'O motivo pelo qual o inquilino está solicitando a alteração no contrato.',
    example: 'Gostaria de ajustar a cláusula sobre animais de estimação.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'O motivo da solicitação não pode estar vazio.' })
  @MaxLength(1000, { message: 'O motivo não pode exceder 1000 caracteres.' })
  reason: string;
}
