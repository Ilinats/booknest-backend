import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomLogger } from './logger/logger.service';
import { ValidationPipe } from '@nestjs/common';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { LoggingInterceptor } from './common/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SeedingService } from './seeds/seeding.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger(),
  });

  app.setGlobalPrefix('api');

  app.use(new RequestIdMiddleware().use as any);

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BookNest API')
    .setDescription('BookNest Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const shouldSeed =
    process.env.RUN_SEEDING === 'true' ||
    process.env.NODE_ENV === 'development';
  if (shouldSeed) {
    try {
      const seedingService = app.get(SeedingService);
      await seedingService.seed();
    } catch (error) {
      console.error('Error during seeding:', error);
    }
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
