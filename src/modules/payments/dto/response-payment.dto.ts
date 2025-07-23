import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  amountDue: number;

  @ApiProperty({ required: false, nullable: true })
  amountPaid?: number | null;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ required: false, nullable: true })
  paidAt?: Date | null;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDENTE })
  status: PaymentStatus;

  @ApiProperty({ format: 'uuid' })
  contractId: string;
}
