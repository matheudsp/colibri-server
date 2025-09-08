import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from './create-user.dto';
import { ROLES } from 'src/common/constants/roles.constant';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Define o novo papel do usuário (Apenas Admins podem alterar)',
    enum: ROLES,
    required: false,
  })
  @IsOptional()
  @IsEnum(ROLES)
  role?: UserRole;

  @ApiProperty({
    description: 'Token de ação obrigatório para usuários não-ADMIN.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actionToken?: string;
}
