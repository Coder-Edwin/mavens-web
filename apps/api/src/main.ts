import 'dotenv/config'; // must be the very first import — AuthModule reads
// process.env.JWT_SECRET at import time, before Nest's own bootstrap runs
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any fields not declared in a DTO
      forbidNonWhitelisted: true, // rejects requests that include unknown fields
      transform: true, // turns plain JSON into typed DTO instances
    })
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Mavens API running on http://localhost:${port}/api/v1`);
}

bootstrap();