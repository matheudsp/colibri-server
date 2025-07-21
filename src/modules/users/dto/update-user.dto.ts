import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from '@prisma/client';
import { Expose } from 'class-transformer';

export class UpdateUserDto {
  @Expose()
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @Expose()
  @ApiProperty()
  @IsEmail()
  email?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @Expose()
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role?: UserRole;

  @Expose()
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  status?: boolean = true;
}
