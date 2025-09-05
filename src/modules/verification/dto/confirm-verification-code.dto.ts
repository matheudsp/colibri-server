import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ConfirmVerificationCodeDto {
  @ApiProperty({
    description: 'O contexto da operação a ser confirmada.',
    example: 'PIX_KEY_UPDATE',
  })
  @IsString()
  @IsNotEmpty()
  context: string;

  @ApiProperty({
    description: 'O código de 6 dígitos enviado para o e-mail do usuário.',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'O código deve ter exatamente 6 dígitos.' })
  code: string;
}
