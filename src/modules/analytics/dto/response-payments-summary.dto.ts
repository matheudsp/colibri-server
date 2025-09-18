import { ApiProperty } from '@nestjs/swagger';

export class PaymentsSummaryResponseDto {
  @ApiProperty()
  period: string;

  @ApiProperty()
  received: number;

  @ApiProperty()
  pending: number;
}
