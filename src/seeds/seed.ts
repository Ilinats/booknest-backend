import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedingService } from './seeding.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedingService = app.get(SeedingService);

  try {
    await seedingService.seed();
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
