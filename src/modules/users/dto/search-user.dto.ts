import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Expose } from 'class-transformer';

export class SearchUserDto {
  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @Expose()
  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  role?: UserRole;

  @Expose()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
