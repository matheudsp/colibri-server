import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendNotificationDto {
  @ApiProperty({
    description: 'ID do usuário (signatário) que receberá a notificação.',
  })
  @IsUUID()
  @IsNotEmpty()
  signerId: string;

  // @ApiProperty({
  //   enum: ['email', 'whatsapp'],
  //   description: 'Método de notificação.',
  // })
  // @IsEnum(['email', 'whatsapp'])
  // @IsNotEmpty()
  // method: 'email' | 'whatsapp';
}
