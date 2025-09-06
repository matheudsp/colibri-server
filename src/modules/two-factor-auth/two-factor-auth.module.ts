import { Module } from '@nestjs/common';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { VerificationModule } from '../verification/verification.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, VerificationModule, AuthModule],
  controllers: [TwoFactorAuthController],
  providers: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {}
