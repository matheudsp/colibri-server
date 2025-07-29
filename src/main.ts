import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './docs/swagger.config';
import { PrismaService } from './prisma/prisma.service';
import { Logger, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);
  const logger = new Logger('Bootstrap');
  const port = process.env.PORT || 3000;

  app.setGlobalPrefix('api/v1');
  setupSwagger(app);
  app.useGlobalInterceptors(new TransformInterceptor());
  prismaService.enableShutdownHooks(app);
  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:3001',
      'https://colibri-app.com',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'X-Requested-With',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      disableErrorMessages: false,
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('❌ Erro ao iniciar o app:', err);
  console.error('❌ Stack:', err.stack);
  process.exit(1);
});
