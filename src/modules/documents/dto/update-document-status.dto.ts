import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { Expose } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateDocumentStatusDto {
  @Expose()
  @ApiProperty({
    description: 'The new status for the document',
    enum: DocumentStatus,
    example: DocumentStatus.REPROVADO,
  })
  @IsEnum(DocumentStatus)
  @IsNotEmpty()
  status: DocumentStatus;

  @Expose()
  @ApiProperty({
    description: 'Motivo da reprovação. Obrigatório se o status for REPROVADO.',
    example: 'A foto do documento está ilegível.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.status === DocumentStatus.REPROVADO)
  @IsNotEmpty({
    message: 'O motivo da reprovação é obrigatório ao reprovar um documento.',
  })
  rejectionReason?: string;
}
