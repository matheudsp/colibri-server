import { forwardRef, Module } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { jwtConfig } from 'src/config/jwt.config';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/modules/users/users.module';
import { QueueModule } from 'src/queue/queue.module';
import { VerificationModule } from 'src/modules/verification/verification.module';
import { FlagsModule } from 'src/feature-flags/flags.module';
import { LogHelperService } from 'src/modules/logs/log-helper.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtConfig,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    UserModule,
    QueueModule,
    VerificationModule,
    FlagsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LogHelperService],
  exports: [JwtModule, JwtStrategy],
})
export class AuthModule {}
