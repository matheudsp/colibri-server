import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { VerificationService } from './verification.service';
import { RequestVerificationCodeDto } from './dto/request-verification-code.dto';
import { ConfirmVerificationCodeDto } from './dto/confirm-verification-code.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Verification')
@Controller('verification')
@RequireAuth()
@ApiBearerAuth()
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita um código de verificação por e-mail' })
  async requestVerificationCode(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: RequestVerificationCodeDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return this.verificationService.generateAndSendCode(
      currentUser.sub,
      body.context,
      currentUser.email,
      user.name,
    );
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma uma ação com o código de verificação' })
  async confirmVerificationCode(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: ConfirmVerificationCodeDto,
  ) {
    return this.verificationService.verifyCode(
      currentUser.sub,
      body.context,
      body.code,
    );
  }
}
