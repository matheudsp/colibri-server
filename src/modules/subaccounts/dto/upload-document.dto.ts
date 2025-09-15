import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { AsaasDocumentType } from 'src/common/constants/asaas.constants';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'O tipo do documento que está sendo enviado.',
    enum: AsaasDocumentType,
    example: AsaasDocumentType.SOCIAL_CONTRACT,
  })
  @IsEnum(AsaasDocumentType)
  @IsNotEmpty()
  type: AsaasDocumentType;
}
