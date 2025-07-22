import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ContractStatus, GuaranteeType } from '@prisma/client';

export class CreateContractDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ enum: ContractStatus })
  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  rentAmount: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  condoFee?: number;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  iptuFee?: number;

  @ApiProperty()
  @IsDateString()
  startDate: Date;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  durationInMonths: number;

  @ApiProperty({ enum: GuaranteeType })
  @IsEnum(GuaranteeType)
  @IsOptional()
  guaranteeType?: GuaranteeType;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  @Min(0)
  securityDeposit?: number;
}
