# AI Development Guide for Banking Backend

This document provides comprehensive guidance for AI models working with this NestJS banking backend. Follow these patterns strictly to maintain bank-level security and code consistency.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Security Requirements](#security-requirements)
3. [Module Structure](#module-structure)
4. [Code Patterns](#code-patterns)
5. [Database Operations](#database-operations)
6. [API Design](#api-design)
7. [Error Handling](#error-handling)
8. [Testing Requirements](#testing-requirements)
9. [Deployment Considerations](#deployment-considerations)

---

## Architecture Overview

### Core Principles

This backend follows **SOLID principles** with a **microservice-ready architecture**:

```
src/
├── config/           # Environment configuration
├── database/         # DrizzleORM schemas and migrations
├── common/           # Shared utilities (guards, filters, decorators)
└── modules/          # Feature modules (self-contained units)
    ├── auth/
    ├── users/
    ├── accounts/
    ├── transactions/
    ├── kyc/
    └── notifications/
```

### Module Isolation

Each module is designed for potential microservice extraction:

- **Self-contained**: All business logic within the module
- **Repository Pattern**: Data access abstracted from business logic
- **Exported Services**: Only service layer exposed to other modules
- **No Cross-Module Repository Access**: Modules communicate via services

---

## Security Requirements

### CRITICAL: Authentication & Authorization

1. **All endpoints require authentication** unless explicitly marked with `@Public()`
2. **Use PIN-based authentication** (6-digit numeric) - NOT passwords
3. **Separate Login PIN and Transaction PIN**
4. **Always verify resource ownership** before operations

```typescript
// CORRECT: Verify ownership in service layer
async findById(id: string, userId: string): Promise<Account> {
  const account = await this.accountsRepository.findById(id);

  if (!account) {
    throw new NotFoundException({
      code: 'ACCOUNT_NOT_FOUND',
      message: 'Account not found',
    });
  }

  // CRITICAL: Always verify ownership
  if (account.userId !== userId) {
    throw new ForbiddenException({
      code: 'ACCOUNT_ACCESS_DENIED',
      message: 'Access denied to this account',
    });
  }

  return account;
}
```

### Sensitive Data Handling

1. **Never log sensitive data** (PINs, tokens, full account numbers)
2. **Mask sensitive fields** in API responses
3. **Use audit logging** for all security events

```typescript
// CORRECT: Mask sensitive data in responses
return {
  documentNumber: doc.documentNumber
    ? '****' + doc.documentNumber.slice(-4)
    : null,
};

// WRONG: Never expose full sensitive data
return { documentNumber: doc.documentNumber }; // NEVER DO THIS
```

### PIN Security

```typescript
// CORRECT: Use Argon2 for PIN hashing
import * as argon2 from 'argon2';

const hashedPin = await argon2.hash(pin, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

// CORRECT: PIN validation
@IsString()
@Length(6, 6)
@Matches(/^\d{6}$/, { message: 'PIN must be 6 digits' })
pin: string;
```

---

## Module Structure

### Standard Module Layout

Every feature module follows this structure:

```
modules/
└── {feature}/
    ├── {feature}.module.ts       # Module definition
    ├── {feature}.controller.ts   # HTTP endpoints
    ├── {feature}.service.ts      # Business logic
    ├── {feature}.repository.ts   # Data access
    └── dto/                      # Data Transfer Objects
        ├── create-{feature}.dto.ts
        ├── update-{feature}.dto.ts
        └── {feature}-response.dto.ts
```

### Module Definition Template

```typescript
import { Module } from '@nestjs/common';
import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';
import { FeatureRepository } from './feature.repository';

/**
 * Feature Module
 *
 * Handles:
 * - [List responsibilities]
 *
 * MICROSERVICE NOTE:
 * Uses repository pattern for data access.
 * Can be extracted as standalone {Feature} Service.
 */
@Module({
  imports: [], // Only import required modules
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService], // Only export service
})
export class FeatureModule {}
```

---

## Code Patterns

### Repository Pattern

Repositories handle ALL database operations:

```typescript
@Injectable()
export class FeatureRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Method description - what it does
   */
  async findById(id: string): Promise<Feature | null> {
    const [feature] = await this.db
      .select()
      .from(features)
      .where(eq(features.id, id))
      .limit(1);
    return feature || null;
  }
}
```

### Service Pattern

Services contain ALL business logic:

```typescript
@Injectable()
export class FeatureService {
  constructor(
    private readonly featureRepository: FeatureRepository,
    // Inject other services, NOT repositories
    private readonly otherService: OtherService,
  ) {}

  /**
   * Method description
   * Include any SECURITY or CRITICAL notes
   */
  async create(userId: string, dto: CreateFeatureDto): Promise<Feature> {
    // 1. Validate business rules
    // 2. Call repository
    // 3. Return result
  }
}
```

### Controller Pattern

Controllers handle HTTP layer ONLY:

```typescript
@ApiTags('Features')
@Controller('features')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  /**
   * Endpoint description
   */
  @Get(':id')
  @ApiOperation({ summary: 'Short summary', description: 'Detailed description' })
  @ApiParam({ name: 'id', description: 'Feature ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getFeature(
    @CurrentUser('id') userId: string,
    @Param('id') featureId: string,
  ) {
    const feature = await this.featureService.findById(featureId, userId);
    // Transform to response shape
    return {
      id: feature.id,
      // Only expose necessary fields
    };
  }
}
```

---

## Database Operations

### Schema Definition

Use DrizzleORM with PostgreSQL:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const features = pgTable('features', {
  // Primary key - always UUID
  id: uuid('id').primaryKey().defaultRandom(),

  // Foreign keys
  userId: uuid('user_id').notNull().references(() => users.id),

  // Required fields
  name: varchar('name', { length: 100 }).notNull(),

  // Optional fields
  description: text('description'),

  // Monetary values - always use decimal(19,4)
  amount: decimal('amount', { precision: 19, scale: 4 }).notNull(),

  // Status fields - use varchar with enum-like values
  status: varchar('status', { length: 20 }).notNull().default('pending'),

  // Timestamps - always include these
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete
}, (table) => ({
  // Index frequently queried columns
  userIdIdx: index('features_user_id_idx').on(table.userId),
  statusIdx: index('features_status_idx').on(table.status),
}));

// Export types for TypeScript
export type Feature = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;
```

### Transaction Safety

For operations affecting multiple tables:

```typescript
// CRITICAL: Use database transactions for monetary operations
async transfer(userId: string, dto: TransferDto): Promise<Transaction> {
  // NOTE: In production, wrap in database transaction
  // await this.db.transaction(async (tx) => {
  //   // All operations use tx instead of this.db
  // });

  // Validate before any modifications
  const sourceAccount = await this.accountsService.findById(dto.sourceAccountId, userId);

  // Check balance BEFORE creating transaction
  if (parseFloat(sourceAccount.availableBalance) < dto.amount) {
    throw new BadRequestException({
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient funds',
    });
  }

  // Create immutable transaction record
  // Update balances atomically
}
```

---

## API Design

### Standard Response Format

All API responses follow this structure:

```typescript
// Success response (automatic via TransformInterceptor)
{
  "statusCode": 200,
  "message": "Success",
  "data": { /* response data */ },
  "timestamp": "2024-01-15T10:30:00.000Z"
}

// Error response (automatic via HttpExceptionFilter)
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/accounts"
}
```

### DTO Validation

Always validate incoming data:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  MaxLength,
  MinLength,
  IsUUID,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateFeatureDto {
  @ApiProperty({
    description: 'Clear field description',
    example: 'Example value',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional field description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Amount in currency',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Status',
    enum: ['active', 'inactive'],
  })
  @IsString()
  @IsIn(['active', 'inactive'])
  status: string;
}
```

### Swagger Documentation

Every endpoint must have complete Swagger docs:

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiOperation({
  summary: 'Create a feature',
  description: 'Creates a new feature for the authenticated user',
})
@ApiBody({ type: CreateFeatureDto })
@ApiResponse({
  status: 201,
  description: 'Feature created successfully',
  schema: {
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
})
@ApiResponse({
  status: 400,
  description: 'Validation error',
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized',
})
async create(
  @CurrentUser('id') userId: string,
  @Body() createDto: CreateFeatureDto,
) {
  // Implementation
}
```

---

## Error Handling

### Standard Error Codes

Use consistent error codes across the application:

```typescript
// Resource errors
'USER_NOT_FOUND'
'ACCOUNT_NOT_FOUND'
'TRANSACTION_NOT_FOUND'

// Access errors
'UNAUTHORIZED'
'ACCOUNT_ACCESS_DENIED'
'TRANSACTION_ACCESS_DENIED'

// Validation errors
'VALIDATION_ERROR'
'INVALID_PIN'
'INVALID_OTP'

// Business logic errors
'INSUFFICIENT_FUNDS'
'ACCOUNT_LOCKED'
'TIER_REQUIREMENTS_NOT_MET'
'DUPLICATE_TRANSACTION'
```

### Throwing Errors

```typescript
// CORRECT: Use structured error format
throw new NotFoundException({
  code: 'ACCOUNT_NOT_FOUND',
  message: 'Account not found',
});

throw new BadRequestException({
  code: 'INSUFFICIENT_FUNDS',
  message: 'Insufficient funds for this transaction',
});

throw new ForbiddenException({
  code: 'ACCOUNT_ACCESS_DENIED',
  message: 'Access denied to this account',
});

// WRONG: Never use plain strings
throw new NotFoundException('Account not found'); // Don't do this
```

---

## Testing Requirements

### Unit Test Structure

```typescript
describe('FeatureService', () => {
  let service: FeatureService;
  let repository: jest.Mocked<FeatureRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FeatureService,
        {
          provide: FeatureRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    repository = module.get(FeatureRepository);
  });

  describe('findById', () => {
    it('should return feature when found and user owns it', async () => {
      // Arrange
      const mockFeature = { id: '1', userId: 'user-1', name: 'Test' };
      repository.findById.mockResolvedValue(mockFeature);

      // Act
      const result = await service.findById('1', 'user-1');

      // Assert
      expect(result).toEqual(mockFeature);
    });

    it('should throw ForbiddenException when user does not own resource', async () => {
      // Arrange
      const mockFeature = { id: '1', userId: 'user-1', name: 'Test' };
      repository.findById.mockResolvedValue(mockFeature);

      // Act & Assert
      await expect(service.findById('1', 'user-2'))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
```

### Security Tests Required

Every module must include tests for:

1. **Authentication**: Endpoints reject unauthenticated requests
2. **Authorization**: Users cannot access other users' resources
3. **Input Validation**: Invalid inputs are rejected
4. **Rate Limiting**: Endpoints respect rate limits

---

## Deployment Considerations

### Environment Variables

Required environment variables:

```bash
# Application
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_SSL=true

# Security
JWT_SECRET=<256-bit-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### Microservice Extraction

When extracting a module to a microservice:

1. **Create standalone NestJS app** with the module
2. **Replace service imports** with message queue (RabbitMQ/Kafka)
3. **Implement idempotency** for message processing
4. **Add circuit breakers** for resilience
5. **Update API gateway** for routing

---

## Checklist for AI Code Generation

Before generating code, verify:

- [ ] Uses repository pattern for data access
- [ ] Service layer contains all business logic
- [ ] Controller only handles HTTP concerns
- [ ] All endpoints have Swagger documentation
- [ ] DTOs have proper validation decorators
- [ ] Ownership verification in service methods
- [ ] Sensitive data is masked in responses
- [ ] Error codes are structured and consistent
- [ ] No direct repository imports across modules
- [ ] Timestamps (createdAt, updatedAt) on all tables
- [ ] UUID primary keys
- [ ] Decimal type for monetary values
- [ ] Audit logging for security events

---

## Quick Reference

### Common Imports

```typescript
// NestJS
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';

// Swagger
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Validation
import { IsString, IsNumber, IsOptional, IsPositive, MaxLength, MinLength, IsUUID, IsIn, Matches, IsDateString, Length } from 'class-validator';

// Database
import { Inject } from '@nestjs/common';
import { eq, and, or, desc, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';

// Custom
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';
```

### Path Aliases

```typescript
// Use these aliases in imports
@config/       → src/config/
@database/     → src/database/
@common/       → src/common/
@modules/      → src/modules/
```

---

**Last Updated**: January 2025
**Version**: 1.0.0
