import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
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

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    return this.authService.loginEmployee(loginDto);
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
