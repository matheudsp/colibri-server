import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestVerificationCodeDto {
  @ApiProperty({
    description: 'O contexto da operação que requer verificação.',
    example: 'PIX_KEY_UPDATE',
  })
  @IsString()
  @IsNotEmpty()
  context: string;
}
