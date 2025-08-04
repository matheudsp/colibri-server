import { ApiProperty } from '@nestjs/swagger';
import { PdfType } from '@prisma/client';

export class PdfResponseDto {
  @ApiProperty({
    description: 'PDF document ID',
  })
  id!: string;

  @ApiProperty({
    description: 'Contract ID',
  })
  contractId!: string;

  @ApiProperty({
    description: 'Path to the PDF file',
  })
  filePath!: string;

  @ApiProperty({
    description: 'Type of PDF',
    enum: PdfType,
  })
  pdfType!: PdfType;

  @ApiProperty({
    description: 'Path to the signed PDF file (if available)',
    required: false,
  })
  signedFilePath?: string;

  @ApiProperty({
    description: 'Date when PDF was generated',
  })
  generatedAt!: Date;
}
