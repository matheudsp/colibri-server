import { ApiProperty } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';

export class PropertyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: PropertyType })
  propertyType!: PropertyType;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  cep!: string;

  @ApiProperty()
  street!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty()
  complement!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty()
  areaInM2!: number;

  @ApiProperty()
  numRooms!: number;

  @ApiProperty()
  numBathrooms!: number;

  @ApiProperty()
  numParking!: number;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  landlordId!: string;

  @ApiProperty()
  landlord!: {
    name: string;
    email: string;
  };

  @ApiProperty()
  photos!: {
    id: string;
    filePath: string;
    description: string;
  }[];
}
