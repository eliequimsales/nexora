import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? allowedOrigins
      : true,
    credentials: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3001;

  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}

bootstrap();
