import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class DeletePropertyDto {
  @ApiProperty({
    description:
      'Token de verificação recebido após a confirmação do código OTP. Obrigatório para locadores.',
    required: false,
  })
  @IsString()
  @IsOptional()
  actionToken?: string;
}
