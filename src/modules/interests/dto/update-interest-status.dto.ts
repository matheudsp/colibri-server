import { ApiProperty } from '@nestjs/swagger';
import { InterestStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateInterestStatusDto {
  @ApiProperty({
    description: 'O novo status do interesse (ex: CONTACTED ou DISMISSED).',
    enum: ['CONTACTED', 'DISMISSED'],
  })
  @IsEnum(['CONTACTED', 'DISMISSED'])
  @IsNotEmpty()
  status: InterestStatus;

  @ApiProperty({
    description: 'Motivo da dispensa. Obrigatório se o status for DISMISSED.',
    required: false,
    example: 'Imóvel já está em processo de locação com outro interessado.',
  })
  @ValidateIf((o) => o.status === InterestStatus.DISMISSED) // Valida apenas se o status for 'DISMISSED'
  @IsNotEmpty({
    message: 'O motivo da dispensa é obrigatório ao dispensar um interesse.',
  })
  @IsString()
  @MaxLength(500)
  dismissalReason?: string;
}
