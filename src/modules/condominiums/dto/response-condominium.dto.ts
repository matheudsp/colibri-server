import { ApiProperty } from '@nestjs/swagger';

export class CondominiumResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  cep: string;

  @ApiProperty()
  street: string;

  @ApiProperty()
  number: string;

  @ApiProperty()
  district: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  landlordId: string;
}
