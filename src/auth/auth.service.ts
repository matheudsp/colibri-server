import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../common/interfaces/jwt.payload.interface';
import { RegisterResponse } from '../common/interfaces/response.register.interface';
import { LoginResponse } from '../common/interfaces/response.login.interface';
import { User } from '@prisma/client';
import { UserResponseDto } from '../modules/users/dto/response-user.dto';
import { UserService } from 'src/modules/users/users.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { Queue } from 'bull';
import { EmailJobType } from 'src/queue/jobs/email.job';
import { PasswordUtil } from 'src/common/utils/hash.utils';
import { CreateLandlordDto } from 'src/modules/users/dto/create-landlord.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
    private configService: ConfigService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
  ) {}
  async refreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateToken(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

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

  async login(loginDto: LoginDto): Promise<LoginResponse> {
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

  async registerLandlord(
    registerDto: CreateLandlordDto,
  ): Promise<RegisterResponse> {
    const user = await this.userService.create(registerDto, ROLES.LOCADOR);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: payload,
    };
  }

  async registerUser(registerDto: CreateUserDto): Promise<RegisterResponse> {
    const user = await this.userService.create(registerDto, ROLES.LOCATARIO);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: payload,
    };
  }

  private generateToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: payload,
    };
  }

  /**
   * Solicita a redefinição de senha.
   * Gera um token, armazena seu hash e enfileira o envio de e-mail.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Resposta genérica para evitar enumeração de e-mails
    const successMessage =
      'Se o e-mail existir em nossa base, um link de redefinição será enviado.';

    if (!user) {
      return { message: successMessage };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await this.hashData(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // Expira em 1 hora

    await this.prisma.user.update({
      where: { email },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    // Enfileira e-mail, enviando o token original (não-hasheado)
    await this.emailQueue.add(EmailJobType.RECOVERY_PASSWORD, {
      email: user.email,
      name: user.name,
      token: resetToken,
      expiresIn: '1 hora',
    });

    return { message: successMessage };
  }

  /**
   * Reseta a senha do usuário usando o token e a nova senha.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const hashedToken = await this.hashData(token);

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const newHashedPassword = await PasswordUtil.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHashedPassword,
        resetToken: null, // Invalida o token após o uso
        resetTokenExpiry: null,
      },
    });

    return { message: 'Senha redefinida com sucesso.' };
  }

  /**
   * Helper para hashear dados (como o token) de forma consistente.
   */
  private async hashData(data: string): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
