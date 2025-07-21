import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsEmail, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @Expose()
  @ApiProperty({ required: false })
  @IsEmail()
  @ValidateIf((o) => !o.accessKeyToken)
  email?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsString()
  @MinLength(6)
  @ValidateIf((o) => !o.accessKeyToken)
  password?: string;

  @Expose()
  @ApiProperty({ required: false })
  @IsString()
  @ValidateIf((o) => !o.email && !o.password)
  accessKeyToken?: string;
}
