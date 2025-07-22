import { Module } from '@nestjs/common';
import { MailerModule as NestMailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { mailerConfig } from '../config/mailer.config';
import { MailerService } from './mailer.service';

@Module({
  imports: [
    NestMailerModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: mailerConfig,
    }),
  ],
  providers: [MailerService],
  exports: [NestMailerModule, MailerService],
})
export class MailerModule {}
