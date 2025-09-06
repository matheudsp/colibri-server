import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString, Length } from 'class-validator';

export class Login2FADto {
  @ApiProperty({
    description: 'O token temporário recebido após a validação da senha.',
  })
  @IsJWT()
  @IsNotEmpty()
  partialToken: string;

  @ApiProperty({
    description: 'O código de 6 dígitos enviado para o e-mail do usuário.',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
