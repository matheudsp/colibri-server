import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateDocumentStatusDto {
  @ApiProperty({
    description: 'The new status for the document',
    enum: DocumentStatus,
    example: DocumentStatus.APROVADO,
  })
  @IsEnum(DocumentStatus)
  @IsNotEmpty()
  status: DocumentStatus;
}
