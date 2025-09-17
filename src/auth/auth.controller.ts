import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  Res,
  HttpStatus,
  Req,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { Public } from 'src/common/decorator/public.decorator';
import { JwtAuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';
import { CreateLandlordDto } from 'src/modules/users/dto/create-landlord.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginResponse } from 'src/common/interfaces/response.login.interface';
import { Login2FADto } from './dto/login-2fa.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async getMe(@CurrentUser() currentUser: JwtPayload) {
    return this.authService.getMe(currentUser.sub);
  }

  @Public()
  @Post('refresh')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const { access_token } = await this.authService.refreshToken(refreshToken);

    res.cookie('accessToken', access_token, {
      httpOnly: true,
      secure: true,
      // NO MOMENTO NAO PODE SER STRICT, O DOMINIO DA API É DIFERENTE DO CLIENT(FRONTEND)
      // sameSite: 'strict'
      sameSite: 'none',
      path: '/',
      domain: '.valedosol.space',
      maxAge: 1000 * 60 * 15, // 15 minutos
    });

    return { message: 'Token refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logs out the user by clearing cookies' })
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieOptions = { domain: '.valedosol.space', path: '/' };

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('session-status', cookieOptions);
    return { message: 'Logout successful' };
  }

  @Post('login/2fa')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Completa o login com o código 2FA' })
  @ApiBody({ type: Login2FADto })
  async loginWith2FA(
    @Res({ passthrough: true }) res: Response,
    @Body() login2FADto: Login2FADto,
  ) {
    const r = await this.authService.loginWith2FA(login2FADto);

    res.cookie('accessToken', r.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      domain: '.valedosol.space',
      maxAge: 1000 * 60 * 15, // 15 minutos
    });

    res.cookie('refreshToken', r.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      domain: '.valedosol.space',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    });

    // Indica que a sessão está ativa
    res.cookie('session-status', 'active', {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
      domain: '.valedosol.space',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias (mesma duração do refresh token)
    });
    return {
      message: 'Autenticação de dois fatores bem-sucedida.',
    };
  }
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ) {
    const result = await this.authService.login(loginDto);

    if ('twoFactorRequired' in result && result.twoFactorRequired) {
      return result;
    } else {
      const loginResponse = result as LoginResponse;

      res.cookie('accessToken', loginResponse.access_token, {
        httpOnly: true,
        secure: true,
        // NO MOMENTO NAO PODE SER STRICT, O DOMINIO DA API É DIFERENTE DO CLIENT(FRONTEND)
        // sameSite: 'strict'
        sameSite: 'none',
        path: '/',
        domain: '.valedosol.space',
        maxAge: 1000 * 60 * 15, // 15 minutos
      });

      res.cookie('refreshToken', loginResponse.refresh_token, {
        httpOnly: true,
        secure: true,
        // NO MOMENTO NAO PODE SER STRICT, O DOMINIO DA API É DIFERENTE DO CLIENT(FRONTEND)
        // sameSite: 'strict'
        sameSite: 'none',
        path: '/',
        domain: '.valedosol.space',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
      });

      res.cookie('session-status', 'active', {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: '.valedosol.space',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias (mesma duração do refresh token)
      });

      return {
        message: 'Autenticação bem-sucedida.',
      };
    }
  }

  @Post('register')
  @Public()
  @ApiBody({ type: CreateUserDto })
  @ApiOperation({ summary: 'Register a new standard user (Tenant)' })
  async registerUser(@Body() registerDto: CreateUserDto) {
    return this.authService.registerUser(registerDto);
  }

  @Post('register/landlord')
  @Public()
  @ApiBody({ type: CreateLandlordDto })
  @ApiOperation({ summary: 'Register a new Landlord' })
  async registerLandlord(@Body() registerDto: CreateLandlordDto) {
    return this.authService.registerLandlord(registerDto);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password using a token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica o e-mail do usuário com um token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenvia o e-mail de verificação' })
  async resendVerificationEmail(@CurrentUser() currentUser: JwtPayload) {
    return this.authService.resendVerificationEmail(currentUser);
  }
}
