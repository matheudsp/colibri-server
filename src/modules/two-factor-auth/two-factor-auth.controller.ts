import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ConfirmVerificationCodeDto } from '../verification/dto/confirm-verification-code.dto';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { Confirm2FA } from './dto/Confirm2FA.dto';

@ApiTags('Two-Factor Authentication')
@Controller('2fa')
@RequireAuth()
@ApiBearerAuth()
export class TwoFactorAuthController {
  constructor(private readonly twoFactorAuthService: TwoFactorAuthService) {}

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia a ativação do 2FA enviando um código' })
  async enableTwoFactorAuth(@CurrentUser() currentUser: JwtPayload) {
    return this.twoFactorAuthService.enable(currentUser);
  }

  @Post('confirm-enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma e ativa o 2FA com o código OTP' })
  async confirmEnable(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: Confirm2FA,
  ) {
    return this.twoFactorAuthService.confirmEnable(currentUser, body.code);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativa o 2FA com um código OTP de confirmação' })
  async disableTwoFactorAuth(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: Confirm2FA,
  ) {
    // Para desativar, o frontend deve primeiro chamar /verification/request com context 'DISABLE_2FA'
    return this.twoFactorAuthService.disable(currentUser, body.code);
  }
}
