import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateManualTransferDto {
  @ApiPropertyOptional({
    description:
      'Uma descrição opcional para a transferência (ex: "Saque de aluguel do mês X").',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  description?: string;
}
