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
import { AsaasCustomersModule } from './modules/asaas-customers/asaas-customers.module';
import { SubaccountsModule } from './modules/subaccounts/subaccounts.module';
import { BankSlipsModule } from './modules/bank-slips/bank-slips.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PdfsModule } from './modules/pdfs/pdfs.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ClicksignModule } from './modules/clicksign/clicksign.module';
import { TestModule } from './modules/test/test.module';
import { VerificationModule } from './modules/verification/verification.module';
import { TwoFactorAuthModule } from './modules/two-factor-auth/two-factor-auth.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ThrottlerGuard } from '@nestjs/throttler';

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
    AsaasCustomersModule,
    SubaccountsModule,
    BankSlipsModule,
    SchedulerModule,
    WebhooksModule,
    PdfsModule,
    PhotosModule,
    ClicksignModule,
    TestModule,
    VerificationModule,
    TwoFactorAuthModule,
    TransfersModule,
    TestModule,
    HealthModule,
    MetricsModule,
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
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
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
