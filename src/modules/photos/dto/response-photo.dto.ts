import { ApiProperty } from '@nestjs/swagger';

export class PhotoResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  propertyId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  isCover!: boolean;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  signedUrl?: string;

  @ApiProperty()
  property!: {
    id: string;
    title: string;
  };
}
