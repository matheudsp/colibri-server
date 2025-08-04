import { ApiProperty } from '@nestjs/swagger';
import { PdfType } from '@prisma/client';
import { Expose } from 'class-transformer';
import { IsUUID, IsEnum } from 'class-validator';

export class CreatePdfDto {
  @Expose()
  @ApiProperty({
    description:
      'ID of the entity (e.g. Contract) for which the PDF will be generated. ',
  })
  @IsUUID()
  contractId!: string;

  @Expose()
  @ApiProperty({
    description: 'Template of PDF to generate',
    enum: PdfType,
  })
  @IsEnum(PdfType)
  pdfType!: PdfType;
}
