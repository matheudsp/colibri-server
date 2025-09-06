import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { VerificationContext } from 'src/common/constants/verification-contexts.constant';

export class RequestVerificationCodeDto {
  @ApiProperty({
    description: 'O contexto da operação que requer verificação.',
    example: 'PIX_KEY_UPDATE',
  })
  @IsString()
  @IsNotEmpty()
  context: VerificationContext;
}
