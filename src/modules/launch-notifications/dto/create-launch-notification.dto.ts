import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateLaunchNotificationDto {
  @ApiProperty({
    description: 'O e-mail do usuário interessado no lançamento.',
    example: 'interessado@email.com',
  })
  @IsEmail({}, { message: 'Por favor, forneça um endereço de e-mail válido.' })
  @IsNotEmpty({ message: 'O campo de e-mail não pode estar vazio.' })
  @MaxLength(100)
  email: string;
}
