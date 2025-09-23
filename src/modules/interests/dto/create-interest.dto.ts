import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInterestDto {
  @ApiProperty({ description: 'ID do imóvel de interesse.' })
  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({
    description: 'Mensagem opcional para o locador.',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}
