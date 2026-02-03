import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from '@common/interceptors/audit-log.interceptor';
import { AuditService } from '@modules/audit/audit.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS Configuration
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3001');
  app.enableCors({
    origin: corsOrigins.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Device-ID'],
    credentials: true,
    maxAge: 86400,
  });

  // API Prefix (versioning is included in the prefix)
  app.setGlobalPrefix(apiPrefix);

  // Global Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global Filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptors
  const auditService = app.get(AuditService);
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new AuditLogInterceptor(auditService),
  );

  // Swagger Documentation
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BankApp API')
      .setDescription(`
        ## Enterprise Digital Banking API

        This API provides secure banking operations including:
        - User Authentication & Authorization
        - Account Management
        - Transaction Processing
        - KYC Verification
        - Notification Services

        ### Security
        All endpoints require authentication unless marked as public.
        Use Bearer token authentication with JWT tokens.

        ### Rate Limiting
        API requests are rate-limited per client IP and user.
      `)
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'access-token',
      )
      .addTag('Auth', 'Authentication and authorization endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Accounts', 'Bank account operations')
      .addTag('Transactions', 'Transaction processing')
      .addTag('KYC', 'Know Your Customer verification')
      .addTag('Notifications', 'Notification services')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // Graceful Shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                    BankApp API Server                      ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  Environment: ${process.env.NODE_ENV || 'development'}
    ║  Port:        ${port}
    ║  API Prefix:  /${apiPrefix}
    ║  Docs:        http://localhost:${port}/docs
    ╚═══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
