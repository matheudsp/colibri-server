import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

class NotificationPreferencesDto {
  @ApiProperty({
    description:
      'Se verdadeiro, permite que interessados enviem propostas online através da plataforma.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  acceptOnlineProposals?: boolean;

  // @IsOptional()
  // @IsBoolean()
  // notifyOnNewMessage?: boolean;
}

export class UpdateUserPreferencesDto {
  @ApiProperty({
    description: 'Configurações de notificação.',
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;
}
