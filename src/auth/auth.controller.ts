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
// import { ForgotPasswordDto } from './dto/forgot-password.dto';
// import { ResetPasswordDto } from './dto/reset-password.dto';

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
      maxAge: 1000 * 60 * 15, // 15 minutos
    });

    return { message: 'Token refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logs out the user by clearing cookies' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return { message: 'Logout successful' };
  }

  @Post('login')
  @Public()
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ) {
    const { access_token, refresh_token, user } =
      await this.authService.login(loginDto);
    res.cookie('accessToken', access_token, {
      httpOnly: true,
      secure: true,
      // NO MOMENTO NAO PODE SER STRICT, O DOMINIO DA API É DIFERENTE DO CLIENT(FRONTEND)
      // sameSite: 'strict'
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 15, // 15 minutos
    });

    res.cookie('refreshToken', refresh_token, {
      httpOnly: true,
      secure: true,
      // NO MOMENTO NAO PODE SER STRICT, O DOMINIO DA API É DIFERENTE DO CLIENT(FRONTEND)
      // sameSite: 'strict'
      sameSite: 'none',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    });

    return { user };
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

  // @Post('forgot-password')
  // async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
  //   return this.authService.requestPasswordReset(forgotPasswordDto.email);
  // }

  // @Post('reset-password')
  // async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
  //   return this.authService.resetPassword(
  //     resetPasswordDto.token,
  //     resetPasswordDto.newPassword,
  //   );
  // }
}
