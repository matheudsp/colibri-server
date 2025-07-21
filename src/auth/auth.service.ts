import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessKeyDto } from './dto/access-key.dto';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { RegisterResponse } from 'src/common/interfaces/response.register.interface';
import { LoginResponse } from 'src/common/interfaces/response.login.interface';
import { ADMIN_EMAILS } from 'src/common/constants/admin-emails.constant';
import { User } from '@prisma/client';
import { UserResponseDto } from 'src/modules/users/dto/response-user.dto';
import { ROLES } from 'src/common/constants/roles.constant';
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

  async validateEmployee(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user?.password || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return user;
  }

  async validateVisitor(loginDto: LoginDto): Promise<User | null> {
    const { accessKeyToken } = loginDto;

    const accessKey = await this.prisma.accessKey.findFirst({
      where: { token: accessKeyToken },
    });

    if (!accessKey || new Date(accessKey.expiresAt) < new Date()) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: accessKey.userId },
    });

    return user;
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
          cameraType: true,
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

  async loginWithAccessKey(loginDto: LoginDto): Promise<LoginResponse> {
    const { accessKeyToken } = loginDto;

    // 1. Validação da chave de acesso
    const accessKey = await this.prisma.accessKey.findFirst({
      where: { token: accessKeyToken },
      include: {
        user: true,
        project: true,
      },
    });

    if (!accessKey) {
      throw new UnauthorizedException({
        error: 'Chave de acesso não encontrada',
        userType: 'vistoriador',
      });
    }

    if (new Date(accessKey.expiresAt) < new Date()) {
      throw new UnauthorizedException({
        error: 'Chave de acesso expirada',
        userType: 'vistoriador',
      });
    }

    if (accessKey.user.role !== ROLES.VISTORIADOR) {
      throw new UnauthorizedException({
        error: 'Acesso permitido apenas para vistoriadores',
        userType: 'not_vistoriador',
      });
    }

    if (accessKey.user.cameraType !== accessKey.cameraType) {
      throw new UnauthorizedException({
        error: 'Tipo de câmera não corresponde ao vistoriador',
        userType: 'vistoriador',
        cameraMismatch: true,
      });
    }

    const tokenResponse = this.generateToken(accessKey.user);

    return {
      ...tokenResponse,
      projectId: accessKey.projectId,
      user: {
        ...tokenResponse.user,
        cameraType: accessKey.user.cameraType,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const { name, email, password } = registerDto;

    if (!name || !email || !password) {
      throw new BadRequestException('Todos os campos são obrigatórios');
    }

    const isAdmin = ADMIN_EMAILS.includes(email);
    const role = isAdmin ? ROLES.ADMIN : ROLES.FUNCIONARIO;

    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        role,
        password: await argon2.hash(password),
        status: true,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      cameraType: user.cameraType || null,
      isActive: user.status,
    };

    return {
      token: this.jwtService.sign(payload),
      user: {
        sub: user.id,
        email: user.email,
        role: user.role,
        cameraType: user.cameraType || null,
        isActive: user.status,
      },
    };
  }

  async generateAccessKey(accessKeyDto: AccessKeyDto, userId: string) {
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!requestingUser || requestingUser.role === ROLES.VISTORIADOR) {
      throw new BadRequestException(
        'Apenas funcionários ou administradores podem gerar chaves de acesso',
      );
    }

    const surveyor = await this.prisma.user.findFirst({
      where: {
        role: ROLES.VISTORIADOR,
        cameraType: accessKeyDto.cameraType,
      },
    });

    if (!surveyor) {
      throw new BadRequestException(
        `Nenhum vistoriador com o tipo de câmera ${accessKeyDto.cameraType} encontrado`,
      );
    }

    const accessKey = await this.prisma.accessKey.create({
      data: {
        token: crypto.randomBytes(32).toString('hex'),
        projectId: accessKeyDto.projectId,
        userId: surveyor.id,
        generatedBy: userId,
        cameraType: accessKeyDto.cameraType,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    return {
      token: accessKey.token,
      expiresAt: accessKey.expiresAt,
      cameraType: accessKey.cameraType,
      surveyorId: surveyor.id,
      surveyorName: surveyor.name,
    };
  }

  private generateToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      cameraType:
        user.role === ROLES.VISTORIADOR && user.cameraType != null
          ? user.cameraType
          : null,
      isActive: user.status,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
        cameraType:
          user.role === ROLES.VISTORIADOR && user.cameraType != null
            ? user.cameraType
            : null,
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
