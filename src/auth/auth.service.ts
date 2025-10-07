import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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
import { User, type UserRole } from '@prisma/client';
import { UserResponseDto } from '../modules/users/dto/response-user.dto';
import { UserService } from 'src/modules/users/users.service';
import { ROLES } from 'src/common/constants/roles.constant';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { QueueName } from 'src/queue/jobs/jobs';
import { Queue } from 'bull';
import {
  EmailJobType,
  type EmailVerificationJob,
} from 'src/queue/jobs/email.job';
import { PasswordUtil } from 'src/common/utils/hash.utils';
import { CreateLandlordDto } from 'src/modules/users/dto/create-landlord.dto';
import { VerificationService } from 'src/modules/verification/verification.service';
import type { Login2FADto } from './dto/login-2fa.dto';
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';
import { LogHelperService } from 'src/modules/logs/log-helper.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
    private configService: ConfigService,
    @InjectQueue(QueueName.EMAIL) private emailQueue: Queue,
    private verificationService: VerificationService,
    private logHelper: LogHelperService,
  ) {}

  /**
   * Envia um novo link de verificação para o usuário logado.
   */
  async resendVerificationEmail(currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (user.emailVerified) {
      throw new BadRequestException('Este e-mail já foi verificado.');
    }
    await this.sendVerificationEmail(user);
    return { message: 'Um novo e-mail de verificação foi enviado.' };
  }

  /**
   * Valida o token de verificação de e-mail.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Token de verificação é obrigatório.');
    }
    const hashedToken = await this.hashData(token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Token de verificação inválido ou expirado.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });
    await this.logHelper.createLog(user.id, 'VERIFY_EMAIL', 'User', user.id);
    return { message: 'E-mail verificado com sucesso!' };
  }

  private async sendVerificationEmail(user: User) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await this.hashData(verificationToken);
    const tokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 12); // 12 horas

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiry: tokenExpiry,
      },
    });

    await this.emailQueue.add(EmailJobType.EMAIL_VERIFICATION, {
      email: user.email,
      name: user.name,
      token: verificationToken,
    });

    this.logger.log(`E-mail de verificação enfileirado para ${user.email}`);
  }

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
          emailVerified: true,
          isTwoFactorEnabled: true,
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

  /**
   * Etapa 1 do Login: Valida e-mail e senha.
   * Se o 2FA estiver ativo, envia um código e retorna um token parcial.
   * Se não, completa o login.
   */
  async login(
    loginDto: LoginDto,
  ): Promise<
    LoginResponse | { twoFactorRequired: true; partialToken: string }
  > {
    const { email, password } = loginDto;

    if (!email || !password) {
      throw new UnauthorizedException('E-mail e senha são obrigatórios');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await PasswordUtil.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.isTwoFactorEnabled) {
      await this.verificationService.generateAndSendCode('LOGIN_2FA', user.id);

      const partialPayload = { sub: user.id, isTwoFactorAuthenticated: false };
      const partialToken = this.jwtService.sign(partialPayload, {
        expiresIn: '5m',
      });

      this.logger.log(
        `Etapa 1 do Login (2FA) concluída para ${user.email}. Aguardando código.`,
      );

      return {
        twoFactorRequired: true,
        partialToken,
      };
    }

    this.logger.log(`Login direto bem-sucedido para ${user.email}.`);
    return this.generateToken(user);
  }

  async loginWith2FA(login2FADto: Login2FADto): Promise<LoginResponse> {
    const { partialToken, code } = login2FADto;

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(partialToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch (error) {
      throw new UnauthorizedException('Token parcial inválido ou expirado.');
    }

    await this.verificationService.verifyCode(
      payload.sub,
      VerificationContexts.LOGIN_2FA,
      code,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.generateToken(user, true);
  }

  async registerLandlord(
    registerDto: CreateLandlordDto,
  ): Promise<RegisterResponse> {
    const user = await this.userService.create(registerDto, ROLES.LOCADOR);
    await this.sendVerificationEmail(user);
    return this.generateToken(user);
  }

  async registerUser(registerDto: CreateUserDto): Promise<RegisterResponse> {
    const user = await this.userService.create(registerDto, ROLES.LOCATARIO);
    await this.sendVerificationEmail(user);
    return this.generateToken(user);
  }

  private generateToken(
    user: {
      id: string;
      email: string;
      role: UserRole;
      status: boolean;
      emailVerified: boolean;
      isTwoFactorEnabled: boolean;
    },
    isTwoFactorAuthenticated = false,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified ?? false,
      isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
      isTwoFactorAuthenticated: user.isTwoFactorEnabled
        ? isTwoFactorAuthenticated
        : undefined,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      // user: payload,
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
    await this.logHelper.createLog(user.id, 'RESET_PASSWORD', 'User', user.id);
    return { message: 'Senha redefinida com sucesso.' };
  }

  /**
   * Helper para hashear dados (como o token) de forma consistente.
   */
  private async hashData(data: string): Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
