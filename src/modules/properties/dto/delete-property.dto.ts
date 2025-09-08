import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class DeletePropertyDto {
  @ApiProperty({
    description: 'Token de ação recebido via OTP, obrigatório para Locadores.',
    required: false, // Não é obrigatório na requisição para acomodar Admins
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actionToken?: string;
}
