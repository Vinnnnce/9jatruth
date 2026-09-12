import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const port = process.env.PORT || 3000;
  const prefix = process.env.API_PREFIX || 'api/v1';

  // Security middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.APP_URL ? [process.env.APP_URL] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix(prefix);

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('9jatruth API')
    .setDescription('Nigerian civic-politics platform API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
  logger.log(`API base: http://localhost:${port}/${prefix}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
