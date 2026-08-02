import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get('NODE_ENV', 'development');

  assertProductionSecrets(nodeEnv, {
    JWT_ACCESS_SECRET: config.get('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: config.get('JWT_REFRESH_SECRET'),
  });

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get('WEB_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(config.get('PORT', 4000));
}

function assertProductionSecrets(
  nodeEnv: string,
  secrets: Record<string, string | undefined>,
) {
  if (nodeEnv !== 'production') {
    return;
  }

  for (const [name, value] of Object.entries(secrets)) {
    if (!value || value.startsWith('change-me') || value.includes('replace-with') || value.length < 32) {
      throw new Error(`${name} must be set to a strong production secret`);
    }
  }
}

bootstrap();
