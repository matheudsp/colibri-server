import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

export class UpdateSignedPdfDto {
  @Expose()
  @ApiProperty({
    description: 'Path to the signed PDF file',
  })
  @IsString()
  signedFilePath!: string;
}
