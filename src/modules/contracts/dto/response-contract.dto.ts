import { ApiProperty } from '@nestjs/swagger';
import type { GuaranteeType } from '@prisma/client';

export class ContractResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  status!: boolean;

  @ApiProperty()
  rentAmount!: number;

  @ApiProperty()
  condoFee!: number;

  @ApiProperty()
  iptuFee!: number;

  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiProperty()
  durationInMonths!: string;

  @ApiProperty()
  guaranteeType!: GuaranteeType;

  @ApiProperty()
  securityDeposit!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  propertyId!: string;

  @ApiProperty()
  landlordId!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  property!: {
    title: string;
  };

  @ApiProperty()
  landlord!: {
    name: string;
  };

  @ApiProperty()
  tenant!: {
    name: string;
  };
}
