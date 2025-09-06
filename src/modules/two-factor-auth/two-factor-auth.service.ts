import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { VerificationService } from '../verification/verification.service';
import { VerificationContexts } from 'src/common/constants/verification-contexts.constant';

@Injectable()
export class TwoFactorAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  /**
   * Inicia o processo de ativação do 2FA enviando um código de verificação.
   */
  async enable(currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    if (user.isTwoFactorEnabled) {
      throw new BadRequestException(
        'A autenticação de dois fatores já está ativa.',
      );
    }
    return this.verificationService.generateAndSendCode(
      VerificationContexts.LOGIN_2FA,
      user.id,
    );
  }

  /**
   * Confirma a ativação do 2FA com o código OTP.
   */
  async confirmEnable(currentUser: JwtPayload, code: string) {
    await this.verificationService.verifyCode(
      currentUser.sub,
      VerificationContexts.LOGIN_2FA,
      code,
    );
    await this.prisma.user.update({
      where: { id: currentUser.sub },
      data: { isTwoFactorEnabled: true },
    });
    return { message: 'Autenticação de dois fatores ativada com sucesso.' };
  }

  /**
   * Desativa o 2FA, requerindo também um código OTP para segurança.
   */
  async disable(currentUser: JwtPayload, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException(
        'A autenticação de dois fatores não está ativa.',
      );
    }
    // Para desativar, usamos um contexto diferente para garantir que um código
    // de login não possa ser usado para desativar, e vice-versa.
    await this.verificationService.verifyCode(
      currentUser.sub,
      VerificationContexts.DISABLE_2FA,
      code,
    );
    await this.prisma.user.update({
      where: { id: currentUser.sub },
      data: { isTwoFactorEnabled: false },
    });
    return { message: 'Autenticação de dois fatores desativada com sucesso.' };
  }
}
