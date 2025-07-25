import { Module, ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './config/config.module';
import { RateLimitModule } from './core/rate-limit/rate-limit.module';
import { SwaggerModule } from '@nestjs/swagger';
import { FlagsModule } from './feature-flags/flags.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AuthExceptionFilter } from './common/filters/auth-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './auth/guards/auth.guard';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { LogModule } from './modules/logs/logs.module';
import { LoggerModule } from './core/logger/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PropertiesModule } from './modules/properties/properties.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { PaymentsOrdersModule } from './modules/payments-orders/payments-orders.module';
import { QueueModule } from './queue/queue.module';
import { CondominiumsModule } from './modules/condominiums/condominiums.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RateLimitModule,
    SwaggerModule,
    FlagsModule,
    LoggerModule,
    QueueModule,
    AuthModule,
    UserModule,
    LogModule,
    PropertiesModule,
    ContractsModule,
    PaymentsOrdersModule,
    CondominiumsModule,
    DocumentsModule,
    BankAccountsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
