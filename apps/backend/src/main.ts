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
  const allowedOrigins = normalizeOrigins(config.get('WEB_ORIGIN', 'http://localhost:5173'));
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
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

function normalizeOrigins(value: string) {
  return value
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

bootstrap();
