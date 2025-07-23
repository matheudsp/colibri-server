import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Type of the document being uploaded',
    enum: DocumentType,
  })
  @IsEnum(DocumentType)
  @IsNotEmpty()
  type: DocumentType;
}
