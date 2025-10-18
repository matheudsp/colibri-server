import { ApiProperty } from '@nestjs/swagger';

export class GetContractTemplateResponseDto {
  @ApiProperty({
    description: 'O conteúdo HTML bruto do template do contrato.',
  })
  templateHtml: string;

  @ApiProperty({
    description:
      'Um objeto contendo pares de chave-valor para os campos dinâmicos já conhecidos.',
    example: {
      'landlord.name': 'João da Silva',
      'property.street': 'Rua das Flores, 123',
    },
  })
  templateData: Record<string, any>;
}
