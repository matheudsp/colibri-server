import { ApiProperty } from '@nestjs/swagger';

class StatusDto {
  @ApiProperty()
  goodPayer: number;

  @ApiProperty()
  late: number;

  @ApiProperty()
  defaulted: number;
}

export class TenantsStatusResponseDto {
  @ApiProperty()
  totalTenants: number;

  @ApiProperty({ type: StatusDto })
  status: StatusDto;
}
