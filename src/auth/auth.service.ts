import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../common/interfaces/jwt.payload.interface';
import { RegisterResponse } from '../common/interfaces/response.register.interface';
import { LoginResponse } from '../common/interfaces/response.login.interface';
import { ADMIN_EMAILS } from '../common/constants/admin-emails.constant';
import { User } from '@prisma/client';
import { UserResponseDto } from '../modules/users/dto/response-user.dto';
import { ROLES } from '../common/constants/roles.constant';
// import { EmailJobType } from '../queue/jobs/email.job';
// import { InjectQueue } from '@nestjs/bull';
// import { Queue } from 'bull';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    // @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async getMe(userId: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  async loginEmployee(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    if (!email || !password) {
      throw new UnauthorizedException('Email e senha são obrigatórios');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (!user.password || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateToken(user);
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const { name, email, password, cpf } = registerDto;

    if (!name || !email || !password || !cpf) {
      throw new BadRequestException('Todos os campos são obrigatórios');
    }

    const isAdmin = ADMIN_EMAILS.includes(email);
    const role = isAdmin ? ROLES.ADMIN : ROLES.LOCATARIO;

    const userExists = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });

    if (userExists) {
      throw new BadRequestException('Email ou CPF já cadastrado.');
    }

    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        role,
        cpf,
        password: await argon2.hash(password),
        status: true,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isActive: user.status,
    };

    return {
      token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  private generateToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isActive: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  // async requestPasswordReset(email: string): Promise<{ message: string }> {
  //   const user = await this.prisma.user.findUnique({
  //     where: { email },
  //   });

  //   if (!user) {
  //     return {
  //       message: 'Se o email existir, um link de redefinição será enviado',
  //     };
  //   }

  //   const resetToken = crypto.randomBytes(32).toString('hex');
  //   const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

  //   await this.prisma.user.update({
  //     where: { email },
  //     data: {
  //       resetToken,
  //       resetTokenExpiry,
  //     },
  //   });

  //   await this.emailQueue.add(EmailJobType.RECOVERY_PASSWORD, {
  //     email: user.email,
  //     name: user.name,
  //     token: resetToken,
  //     expiresIn: 60, // 60 minutos
  //   });

  //   return {
  //     message: 'Se o email existir, um link de redefinição será enviado',
  //   };
  // }

  // async resetPassword(
  //   token: string,
  //   newPassword: string,
  // ): Promise<{ message: string }> {
  //   const user = await this.prisma.user.findFirst({
  //     where: {
  //       resetToken: token,
  //       resetTokenExpiry: {
  //         gt: new Date(),
  //       },
  //     },
  //   });

  //   if (!user) {
  //     throw new BadRequestException('Token inválido ou expirado');
  //   }

  //   await this.prisma.user.update({
  //     where: { id: user.id },
  //     data: {
  //       password: await argon2.hash(newPassword),
  //       resetToken: null,
  //       resetTokenExpiry: null,
  //     },
  //   });

  //   return { message: 'Senha redefinida com sucesso' };
  // }
}
