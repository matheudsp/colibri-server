import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { MarketingChannel, PreferredPaymentMethod } from '@prisma/client';

export class SubmitSurveyDto {
  @ApiPropertyOptional({
    description: 'Onde o usuário ouviu falar sobre o sistema.',
    enum: MarketingChannel,
    example: MarketingChannel.INSTAGRAM,
  })
  @IsOptional()
  @IsEnum(MarketingChannel)
  channel?: MarketingChannel;

  @ApiPropertyOptional({
    description: 'Método de pagamento preferido do usuário.',
    enum: PreferredPaymentMethod,
    example: PreferredPaymentMethod.PIX,
  })
  @IsOptional()
  @IsEnum(PreferredPaymentMethod)
  preferredPaymentMethod?: PreferredPaymentMethod;
}
