import { ApiProperty } from '@nestjs/swagger';

class OccupancyTypeDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  occupied: number;
}

export class PropertiesOccupancyResponseDto {
  @ApiProperty({ type: [OccupancyTypeDto] })
  types: OccupancyTypeDto[];
}
