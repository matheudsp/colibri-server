import { ApiProperty } from '@nestjs/swagger';

export class LogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  tableName!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty()
  generatedAt!: Date;

  @ApiProperty()
  user!: {
    id: string;
    name: string;
    email: string;
  };
}
