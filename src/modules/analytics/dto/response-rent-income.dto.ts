import { ApiProperty } from '@nestjs/swagger';

class MonthlyIncomeDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  amount: number;
}

export class RentIncomeResponseDto {
  @ApiProperty()
  year: number;

  @ApiProperty({ type: [MonthlyIncomeDto] })
  monthlyIncome: MonthlyIncomeDto[];
}
