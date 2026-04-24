import * as Joi from 'joi';

/**
 * Environment configuration validation schema
 * Ensures all required environment variables are present and valid
 */
export const configValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection URL'),
  DATABASE_POOL_MIN: Joi.number().default(2),
  DATABASE_POOL_MAX: Joi.number().default(10),

  // Redis
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // JWT - Required in production
  JWT_ACCESS_SECRET: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(64).required(),
      otherwise: Joi.string().default('dev-access-secret-change-in-production'),
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(64).required(),
      otherwise: Joi.string().default('dev-refresh-secret-change-in-production'),
    }),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Encryption - Required in production
  ENCRYPTION_KEY: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().length(64).required(), // 32 bytes in hex
      otherwise: Joi.string().default('0000000000000000000000000000000000000000000000000000000000000000'),
    }),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('debug'),

  // Mail (SMTP)
  MAIL_HOST: Joi.string().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().required().description('SMTP username / email'),
  MAIL_PASSWORD: Joi.string().required().description('SMTP password or app password'),
  MAIL_FROM_NAME: Joi.string().default('BankApp'),
  MAIL_FROM_EMAIL: Joi.string().email().default('noreply@bankapp.com'),
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_IGNORE_TLS: Joi.boolean().default(false),
  MAIL_REQUIRE_TLS: Joi.boolean().default(false),

  // Bunny CDN (optional - profile picture uploads)
  BUNNY_STORAGE_API_KEY: Joi.string().optional().default(''),
  BUNNY_STORAGE_ZONE: Joi.string().optional().default(''),
  BUNNY_STORAGE_HOSTNAME: Joi.string().optional().default('storage.bunnycdn.com'),
  BUNNY_CDN_HOSTNAME: Joi.string().optional().default(''),
});
