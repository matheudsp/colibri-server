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

@ApiTags('Verification')
@Controller('verification')
@RequireAuth()
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita um código de verificação por e-mail' })
  async requestVerificationCode(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: RequestVerificationCodeDto,
  ) {
    return this.verificationService.generateAndSendCode(
      body.context,
      currentUser.sub,
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
