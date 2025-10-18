import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateContractHtmlDto {
  @ApiProperty({
    description:
      'O conteúdo HTML completo e personalizado do contrato, vindo do editor.',
    example: '<h1>Contrato de Locação...</h1><p>Cláusula 1...</p>',
  })
  @IsString()
  @IsNotEmpty({ message: 'O conteúdo do contrato não pode estar vazio.' })
  @MinLength(100, {
    message: 'O conteúdo do contrato parece curto demais para ser válido.',
  })
  contractHtml: string;
}
