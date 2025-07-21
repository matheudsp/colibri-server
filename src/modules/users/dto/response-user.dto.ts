import { ApiProperty } from '@nestjs/swagger';
import { CameraType, UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  status!: boolean;

  @ApiProperty()
  cameraType!: CameraType | null;
}
