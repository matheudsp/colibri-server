import { MailerOptions } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import * as path from 'path';

export const mailerConfig = (configService: ConfigService): MailerOptions => ({
  transport: {
    host: configService.get<string>('MAIL_HOST'),
    port: configService.get<number>('MAIL_PORT'),
    secure: true,
    auth: {
      user: configService.get<string>('MAIL_USER'),
      pass: configService.get<string>('MAIL_PASSWORD'),
    },
  },
  defaults: {
    from: `"${configService.get<string>('MAIL_FROM_NAME')}" <${configService.get<string>('MAIL_FROM_ADDRESS')}>`,
  },
  template: {
    // dir:
    // process.env.NODE_ENV === 'development'
    //   ? path.join(__dirname, '..', '..', 'mailer', 'templates')
    //   : path.join(__dirname, '..', 'mailer', 'templates'),
    dir: path.join(__dirname, '..', 'mailer', 'templates'),
    adapter: new HandlebarsAdapter(),
    options: {
      strict: true,
    },
  },
});
