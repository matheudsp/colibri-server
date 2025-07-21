import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @Expose()
  @ApiProperty({
    example: 'Lucas Silva',
    description: 'Nome completo do usuário',
  })
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio' })
  name!: string;

  @Expose()
  @ApiProperty({
    example: 'lucas@gmail.com',
    description: 'Email válido do usuário',
  })
  @IsEmail(
    {},
    {
      message: 'Por favor, insira um email válido (ex: usuario@provedor.com)',
    },
  )
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  email!: string;

  @Expose()
  @ApiProperty({
    example: 'senhaSegura123',
    description: 'Senha com mínimo 6 caracteres',
  })
  @IsString({ message: 'A senha deve ser uma string' })
  @IsNotEmpty({ message: 'A senha não pode estar vazia' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;
}
