import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus, DocumentType } from '@prisma/client';

export class DocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.CPF })
  type: DocumentType;

  @ApiProperty({ description: 'A temporary, signed URL to access the file.' })
  url: string;

  @ApiProperty({
    enum: DocumentStatus,
    example: DocumentStatus.AGUARDANDO_APROVACAO,
  })
  status: DocumentStatus;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  contractId: string;

  @ApiProperty()
  uploadedAt: Date;
}
