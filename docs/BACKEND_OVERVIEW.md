# Banking App Backend - Complete Overview

This document provides a comprehensive summary of the NestJS backend implementation, explaining architectural decisions, module structure, and areas that may need revision.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture Decisions](#architecture-decisions)
5. [Database Schema Design](#database-schema-design)
6. [Module Breakdown](#module-breakdown)
7. [Security Implementation](#security-implementation)
8. [API Endpoints](#api-endpoints)
9. [Configuration](#configuration)
10. [Areas for Review/Revision](#areas-for-reviewrevision)
11. [Next Steps](#next-steps)

---

## Executive Summary

### What Was Built

A production-ready NestJS backend for a banking application with:

- **8 Feature Modules**: Auth, Users, Accounts, Transactions, KYC, Notifications, Mail, Qoreid
- **7 Database Schemas**: Users, Accounts, Transactions, KYC Documents, Sessions, Notifications, Audit Logs
- **PIN-based Authentication**: 6-digit numeric PIN instead of passwords
- **Microservice-ready Architecture**: Each module can be extracted as a standalone service
- **Bank-level Security**: Rate limiting, JWT auth, audit logging, encrypted sensitive data
- **Email System**: SMTP with Handlebars templates for transactional emails
- **Digital Identity Verification**: Qoreid integration for KYC (NIN, BVN, Driver's License, etc.)

### Key Design Principles

1. **SOLID Principles** - Single responsibility, clean interfaces
2. **Repository Pattern** - Data access separated from business logic
3. **Modular Design** - Self-contained feature modules
4. **Security First** - Every decision considers security implications

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | NestJS | Enterprise-grade, modular, TypeScript-first |
| Database | PostgreSQL | ACID compliance, JSON support, mature ecosystem |
| ORM | DrizzleORM | Type-safe, lightweight, SQL-like syntax |
| Authentication | JWT + Argon2 | Stateless auth with memory-hard PIN hashing |
| Validation | class-validator | Decorator-based, integrates with NestJS |
| Documentation | Swagger/OpenAPI | Industry standard, auto-generated docs |
| Rate Limiting | @nestjs/throttler | Built-in NestJS solution |

---

## Project Structure

```
backend/
├── docs/
│   ├── AI_DEVELOPMENT_GUIDE.md    # Guide for AI-assisted development
│   └── BACKEND_OVERVIEW.md        # This document
│
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   │
│   ├── config/                    # Configuration management
│   │   ├── index.ts               # Config exports
│   │   ├── app.config.ts          # App settings (port, env, cors)
│   │   ├── database.config.ts     # Database connection settings
│   │   ├── jwt.config.ts          # JWT secrets and expiration
│   │   ├── redis.config.ts        # Redis settings (for sessions)
│   │   └── config.validation.ts   # Joi validation schema
│   │
│   ├── database/
│   │   ├── database.module.ts     # DrizzleORM setup as global module
│   │   ├── schemas/               # All table definitions
│   │   │   ├── index.ts           # Schema exports
│   │   │   ├── users.schema.ts
│   │   │   ├── accounts.schema.ts
│   │   │   ├── transactions.schema.ts
│   │   │   ├── kyc.schema.ts
│   │   │   ├── sessions.schema.ts
│   │   │   ├── notifications.schema.ts
│   │   │   └── audit-logs.schema.ts
│   │   └── migrations/            # Generated migrations (empty initially)
│   │
│   ├── common/                    # Shared utilities
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts      # @Public() - skip auth
│   │   │   ├── current-user.decorator.ts # @CurrentUser() - get user from request
│   │   │   └── index.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts        # JWT authentication guard
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Standardized error responses
│   │   └── interceptors/
│   │       ├── transform.interceptor.ts  # Standard response wrapper
│   │       └── audit-log.interceptor.ts  # Request/response logging
│   │
│   └── modules/                   # Feature modules
│       ├── auth/
│       ├── users/
│       ├── accounts/
│       ├── transactions/
│       ├── kyc/
│       ├── notifications/
│       ├── mail/                  # Email with Handlebars templates
│       │   └── templates/         # .hbs email templates
│       └── qoreid/                # Digital identity verification
│
├── drizzle.config.ts              # DrizzleORM CLI configuration
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example                   # Environment template
```

---

## Architecture Decisions

### 1. Repository Pattern

**What**: Each module has a repository class that handles all database operations.

**Why**:
- Separates data access from business logic
- Makes testing easier (mock the repository)
- Allows swapping databases without changing services
- Enables microservice extraction (repository becomes API client)

**Structure**:
```
Module/
├── module.ts          # Module definition
├── controller.ts      # HTTP layer only
├── service.ts         # Business logic
├── repository.ts      # Data access
└── dto/               # Data transfer objects
```

### 2. PIN-based Authentication (Not Passwords)

**What**: Users authenticate with a 6-digit numeric PIN instead of traditional passwords.

**Why**:
- Client specification required PIN-based auth
- Common in mobile banking apps
- Simpler for users on mobile devices
- Still secure when combined with device binding and biometrics

**Implementation**:
- PIN hashed with Argon2id (memory-hard algorithm)
- Separate "Login PIN" and "Transaction PIN"
- Account lockout after 5 failed attempts (30 minutes)

### 3. Tier System for Users

**What**: Users have tiers that determine their account capabilities.

**Tiers**:
| Tier | Name | Requirements | Capabilities |
|------|------|--------------|--------------|
| 1 | Basic | Registration only | Limited transactions |
| 2 | Verified | BVN + Government ID | Standard features |
| 3 | Premium | All documents + selfie | Full features |
| 4 | Business | Business documents | Business features |

### 4. Microservice-Ready Design

**What**: Each module is self-contained and can be extracted as a separate service.

**How**:
- Modules only export their Service class
- No cross-module repository access
- Communication between modules via services
- Each module has its own DTOs

**Extraction Process** (when needed):
1. Create new NestJS app with the module
2. Replace service imports with message queue (RabbitMQ/Kafka)
3. Add API gateway for routing

### 5. Immutable Transactions

**What**: Transaction records cannot be modified once created.

**Why**:
- Audit trail integrity
- Regulatory compliance
- Fraud prevention

**Implementation**:
- No UPDATE operations on transactions (except status)
- Reversals create new reverse transactions
- Balance tracking with before/after snapshots

---

## Database Schema Design

### Users Table

```typescript
users {
  id: UUID (primary key)

  // Identity
  email: VARCHAR(255) - unique
  phone: VARCHAR(20) - unique
  firstName: VARCHAR(100)
  lastName: VARCHAR(100)
  middleName: VARCHAR(100) - optional
  dateOfBirth: TIMESTAMP - optional

  // Authentication
  pinHash: VARCHAR(255) - Argon2 hash of login PIN
  transactionPinHash: VARCHAR(255) - Argon2 hash of transaction PIN

  // Status
  status: ENUM('shell', 'pending_verification', 'active', 'suspended', 'closed', 'rejected')
  type: ENUM('individual', 'business', 'merchant')
  tier: ENUM('basic', 'verified', 'premium', 'business')

  // Verification
  emailVerified: BOOLEAN
  phoneVerified: BOOLEAN

  // KYC (encrypted)
  bvnEncrypted: TEXT
  ninEncrypted: TEXT

  // Address
  address, city, state, country, postalCode

  // Security
  failedLoginAttempts: VARCHAR(10)
  lockedUntil: TIMESTAMP
  lastLoginAt: TIMESTAMP
  lastLoginIp: VARCHAR(45)

  // Timestamps
  createdAt, updatedAt, deletedAt (soft delete)
}
```

### Accounts Table

```typescript
accounts {
  id: UUID (primary key) - Internal system ID
  userId: UUID (foreign key -> users)

  // External Core Banking Reference
  accountId: VARCHAR(100) - unique, ID from core banking system

  // Account Identity
  accountNumber: VARCHAR(20) - unique
  accountType: ENUM('savings', 'current', 'fixed_deposit', 'loan', 'investment')
  currency: ENUM('NGN', 'USD', 'GBP', 'EUR')
  nickname: VARCHAR(100) - optional

  // Balances (DECIMAL for precision)
  balance: DECIMAL(18,2)
  availableBalance: DECIMAL(18,2)
  holdAmount: DECIMAL(18,2)

  // Status
  status: ENUM('active', 'dormant', 'frozen', 'closed', 'pending_activation')
  isPrimary: BOOLEAN

  // Interest
  interestRate: DECIMAL(5,2) - optional

  // Timestamps
  openedAt, lastTransactionAt, closedAt, createdAt, updatedAt
}
```

### Transactions Table

```typescript
transactions {
  id: UUID (primary key)
  userId: UUID (foreign key -> users)

  // Account References
  sourceAccountId: UUID - optional (for transfers)
  destinationAccountId: UUID - optional (for transfers)

  // Identity
  reference: VARCHAR(50) - unique transaction reference
  idempotencyKey: VARCHAR(100) - prevents duplicate transactions

  // Type & Status
  type: VARCHAR(30) - 'transfer', 'deposit', 'withdrawal', etc.
  status: VARCHAR(20) - 'pending', 'completed', 'failed', etc.

  // Amounts
  amount: DECIMAL(18,2)
  fee: DECIMAL(18,2)
  currency: VARCHAR(3)

  // Balance Tracking
  balanceBefore: DECIMAL(18,2)
  balanceAfter: DECIMAL(18,2)

  // Description
  description: TEXT
  narration: TEXT

  // Counterparty
  counterpartyName, counterpartyAccount, counterpartyBank

  // Failure
  failureReason: TEXT

  // Metadata
  metadata: JSONB
  channel: VARCHAR(50) - 'web', 'mobile', 'api'

  // Security
  ipAddress: VARCHAR(45)
  deviceId: VARCHAR(100)

  // Timestamps
  initiatedAt, completedAt, createdAt
}
```

### KYC Documents Table

```typescript
kyc_documents {
  id: UUID (primary key)
  userId: UUID (foreign key -> users)

  // Document Info
  documentType: VARCHAR(50) - 'bvn', 'government_id', 'passport', etc.
  documentNumber: VARCHAR(100) - masked in API responses
  status: VARCHAR(20) - 'pending', 'verified', 'rejected'

  // File Storage
  fileUrl: TEXT - encrypted storage URL
  fileName: VARCHAR(255)
  fileSize: INTEGER
  mimeType: VARCHAR(100)

  // Verification
  verifiedAt: TIMESTAMP
  reviewedBy: UUID
  reviewNotes: TEXT

  // Expiry
  expiryDate: TIMESTAMP

  // Timestamps
  createdAt, updatedAt
}
```

### Sessions Table

```typescript
sessions {
  id: UUID (primary key)
  userId: UUID (foreign key -> users)

  // Token
  tokenHash: VARCHAR(255) - hashed refresh token

  // Device Info
  deviceId: VARCHAR(100)
  deviceName: VARCHAR(255)
  deviceType: ENUM('ios', 'android', 'web', 'desktop')

  // Location
  ipAddress: VARCHAR(45)
  userAgent: TEXT
  location: VARCHAR(255)

  // Status
  isActive: BOOLEAN
  isTrusted: BOOLEAN

  // Timestamps
  lastActivityAt, expiresAt, revokedAt, createdAt
}
```

### Notifications Table

```typescript
notifications {
  id: UUID (primary key)
  userId: UUID (foreign key -> users)

  // Classification
  type: VARCHAR(50) - 'transaction', 'security', 'promotion'
  category: VARCHAR(50) - 'transactions', 'security', 'marketing'

  // Content
  title: VARCHAR(200)
  body: TEXT
  data: JSONB - additional payload

  // Status
  isRead: BOOLEAN
  readAt: TIMESTAMP

  // Delivery
  channel: VARCHAR(20) - 'push', 'email', 'sms', 'in_app'
  sentAt, deliveredAt, failedAt
  failureReason: TEXT

  // Timestamps
  createdAt
}
```

### Audit Logs Table

```typescript
audit_logs {
  id: UUID (primary key)

  // Actor
  userId: UUID - optional (null for system actions)
  sessionId: UUID - optional

  // Action
  action: VARCHAR(100) - 'user.login', 'transaction.create', etc.
  resource: VARCHAR(100) - 'user', 'account', 'transaction'
  resourceId: UUID - optional

  // Details
  details: JSONB - action-specific data
  previousState: JSONB - for updates
  newState: JSONB - for updates

  // Request Context
  ipAddress: VARCHAR(45)
  userAgent: TEXT
  requestId: VARCHAR(100)

  // Result
  status: ENUM('success', 'failure', 'error')
  errorMessage: TEXT

  // Timestamps
  createdAt
}
```

---

## Module Breakdown

### 1. Auth Module (`/api/v1/auth`)

**Purpose**: Handle user registration, login, token management.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Create new user account |
| POST | `/login` | Authenticate with email/phone + PIN |
| POST | `/refresh` | Get new access token |
| POST | `/logout` | Revoke current session |

**Key Features**:
- Rate limited (5 registrations/min, 10 logins/min)
- Account lockout after 5 failed attempts
- JWT tokens (15m access, 7d refresh)

**Files**:
- `auth.controller.ts` - HTTP endpoints
- `auth.service.ts` - Auth logic, token generation
- `dto/register.dto.ts` - Registration validation
- `dto/login.dto.ts` - Login validation
- `dto/refresh-token.dto.ts` - Refresh validation
- `strategies/jwt.strategy.ts` - Passport JWT strategy

### 2. Users Module (`/api/v1/users`)

**Purpose**: User profile management.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | Get current user profile |
| PATCH | `/me` | Update profile (name, address) |

**Key Features**:
- Profile fields are validated
- Some fields read-only (email change requires OTP - not yet implemented)

**Files**:
- `users.controller.ts` - HTTP endpoints
- `users.service.ts` - User business logic
- `users.repository.ts` - Database operations
- `dto/update-profile.dto.ts` - Update validation

### 3. Accounts Module (`/api/v1/accounts`)

**Purpose**: Bank account management.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all user accounts |
| GET | `/:id` | Get account details |
| PATCH | `/:id` | Update account (nickname) |
| PATCH | `/:id/set-primary` | Set as primary account |

**Key Features**:
- Ownership verification on all operations
- Balance is read-only (modified only through transactions)
- Multiple accounts per user supported

**Files**:
- `accounts.controller.ts` - HTTP endpoints
- `accounts.service.ts` - Account business logic
- `accounts.repository.ts` - Database operations
- `dto/update-account.dto.ts` - Update validation

### 4. Transactions Module (`/api/v1/transactions`)

**Purpose**: Fund transfers and transaction history.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Transaction history with filters |
| GET | `/:id` | Transaction details |
| POST | `/transfer` | Initiate fund transfer |
| GET | `/reference/:ref` | Lookup by reference |

**Key Features**:
- Immutable transaction records
- Filters: accountId, type, status, date range
- Pagination support

**⚠️ NOTE**: The transfer endpoint is a placeholder. Production requires:
- Database transactions with proper isolation
- Idempotency keys to prevent duplicates
- Transaction PIN verification
- Real balance updates (currently not implemented)

**Files**:
- `transactions.controller.ts` - HTTP endpoints
- `transactions.service.ts` - Transfer logic
- `transactions.repository.ts` - Database operations
- `dto/transfer.dto.ts` - Transfer validation
- `dto/transaction-filters.dto.ts` - Query filters

### 5. KYC Module (`/api/v1/kyc`)

**Purpose**: Identity verification and tier upgrades.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | KYC status and tier progress |
| GET | `/documents` | List submitted documents |
| GET | `/documents/:id` | Document details |
| POST | `/documents` | Upload new document |
| POST | `/upgrade` | Request tier upgrade |

**Key Features**:
- Document type validation
- File size limit (10MB)
- Tier requirements tracking
- Masked document numbers in responses

**Files**:
- `kyc.controller.ts` - HTTP endpoints
- `kyc.service.ts` - KYC business logic
- `kyc.repository.ts` - Database operations
- `dto/upload-document.dto.ts` - Upload validation
- `dto/request-tier-upgrade.dto.ts` - Upgrade validation

### 6. Mail Module (Global)

**Purpose**: Email sending with SMTP and Handlebars templates.

**Features**:
- SMTP configuration (Gmail, SendGrid, etc.)
- Handlebars templating for consistent styling
- Pre-built templates for common emails

**Available Methods** (inject `MailService`):
| Method | Description |
|--------|-------------|
| `sendWelcomeEmail()` | Welcome email for new users |
| `sendOtpEmail()` | OTP verification code |
| `sendPinResetEmail()` | PIN reset link |
| `sendTransactionEmail()` | Transaction notification (credit/debit) |
| `sendSecurityAlertEmail()` | Security alerts (new login, etc.) |
| `sendKycStatusEmail()` | KYC document status updates |
| `sendEmail()` | Generic email with custom template |

**Templates** (in `src/modules/mail/templates/`):
- `welcome.hbs` - Welcome email
- `otp.hbs` - OTP verification
- `pin-reset.hbs` - PIN reset link
- `transaction.hbs` - Transaction alerts
- `security-alert.hbs` - Security notifications
- `kyc-status.hbs` - KYC status updates

**Configuration** (`.env`):
```bash
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_NAME=BankApp
MAIL_FROM_EMAIL=noreply@bankapp.com
```

**Usage Example**:
```typescript
@Injectable()
export class SomeService {
  constructor(private readonly mailService: MailService) {}

  async someMethod() {
    await this.mailService.sendOtpEmail('user@example.com', {
      firstName: 'John',
      otp: '123456',
      purpose: 'Email Verification',
      expiresIn: 10,
    });
  }
}
```

---

### 7. Qoreid Module (Global)

**Purpose**: Digital identity verification via Qoreid API for KYC compliance.

**Features**:
- Token management with automatic refresh and caching
- Support for Nigerian identity documents
- Integration with KYC service for automatic document verification

**Supported Verification Types**:
| Method | Document Type | Description |
|--------|---------------|-------------|
| `verifyNIN()` | NIN | National Identification Number |
| `verifyNINWithPhone()` | NIN | NIN lookup via phone number |
| `verifyVirtualNIN()` | VNIN | Virtual NIN verification |
| `verifyBVNMatch()` | BVN | Boolean match (cheaper option) |
| `verifyBVNBasic()` | BVN | Basic BVN information |
| `verifyBVNPremium()` | BVN | Comprehensive BVN with photo |
| `verifyDriversLicense()` | Driver's License | License verification |
| `verifyPassport()` | International Passport | Passport verification |
| `verifyVotersCard()` | Voter's Card | VIN verification |
| `verifyBankAccount()` | NUBAN | Bank account verification |
| `verifyCACBasic()` | CAC | Business registration |
| `verifyTIN()` | TIN | Tax Identification Number |

**Helper Methods**:
| Method | Description |
|--------|-------------|
| `isVerificationSuccessful()` | Check if verification passed |
| `getMatchPercentage()` | Get field match percentage (0-100) |

**Configuration** (`.env`):
```bash
QOREID_BASE_URL=https://api.qoreid.com
QOREID_CLIENT_ID=your-client-id
QOREID_CLIENT_SECRET=your-client-secret
QOREID_SANDBOX=true
```

**Integration with KYC Service**:

The KYC service uses Qoreid for digital verification:

```typescript
// Verify identity document digitally
const result = await kycService.verifyIdentity(userId, {
  documentType: 'nin',  // 'nin' | 'bvn' | 'drivers_license' | 'passport' | 'voters_card'
  documentNumber: '12345678901',
  firstname: 'John',
  lastname: 'Doe',
  dob: '1990-01-15',
});

// Result includes:
// - success: boolean
// - verified: boolean
// - matchPercentage: number (0-100)
// - verificationId: number (from Qoreid)
// - data: { status, summary }
```

**Files**:
- `src/config/qoreid.config.ts` - Configuration
- `src/modules/qoreid/qoreid.module.ts` - Module definition (global)
- `src/modules/qoreid/qoreid.service.ts` - All verification methods
- `src/modules/kyc/kyc.service.ts` - Integration with KYC workflow

---

### 8. Notifications Module (`/api/v1/notifications`)

**Purpose**: User notification management.

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List notifications (paginated) |
| GET | `/unread` | List unread notifications |
| GET | `/unread/count` | Get unread count |
| GET | `/:id` | Notification details |
| POST | `/:id/read` | Mark as read |
| POST | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |

**Key Features**:
- Multi-channel support (push, email, SMS, in-app)
- Read/unread tracking
- Helper methods for common notifications (transaction, security alert)

**⚠️ NOTE**: Actual notification delivery (FCM, SendGrid, Twilio) is not implemented. The module stores notifications but doesn't send them.

**Files**:
- `notifications.controller.ts` - HTTP endpoints
- `notifications.service.ts` - Notification logic
- `notifications.repository.ts` - Database operations

---

## Security Implementation

### Authentication Flow

```
1. User registers with email, phone, name, PIN
2. PIN is hashed with Argon2id and stored
3. User logs in with email/phone + PIN
4. Server verifies PIN hash
5. If valid: Generate JWT access + refresh tokens
6. If invalid: Increment failed attempts, lock after 5
7. Access token expires in 15 minutes
8. Refresh token used to get new access token (7 days)
```

### Authorization

- All endpoints require JWT authentication by default
- Use `@Public()` decorator to make endpoint public
- JWT contains: user ID, email, token type
- `JwtAuthGuard` validates token on every request
- `@CurrentUser('id')` extracts user ID from token

### Rate Limiting

Configured in `app.module.ts`:
- Short: 10 requests per second
- Medium: 50 requests per 10 seconds
- Long: 100 requests per minute

Auth endpoints have additional limits:
- Registration: 5 per minute
- Login: 10 per minute

### Sensitive Data Handling

1. **PIN Storage**: Argon2id with 64MB memory, 3 iterations
2. **BVN/NIN**: Encrypted at rest (encryption not yet implemented)
3. **Document Numbers**: Masked in API responses (show last 4 only)
4. **Audit Logging**: All sensitive operations logged

### Request/Response Security

1. **Helmet**: Security headers (XSS protection, etc.)
2. **CORS**: Configurable allowed origins
3. **Validation**: All inputs validated with class-validator
4. **Error Handling**: Standardized error responses (no stack traces in production)

---

## API Endpoints

### Base URL
```
http://localhost:3001/api/v1
```

### Swagger Documentation
```
http://localhost:3001/api/docs
```

### Complete Endpoint List

```
Auth:
POST   /auth/register        - Register new user
POST   /auth/login           - Login
POST   /auth/refresh         - Refresh token
POST   /auth/logout          - Logout (requires auth)

Users:
GET    /users/me             - Get profile
PATCH  /users/me             - Update profile

Accounts:
GET    /accounts             - List accounts
GET    /accounts/:id         - Get account
PATCH  /accounts/:id         - Update account
PATCH  /accounts/:id/set-primary - Set primary

Transactions:
GET    /transactions         - List transactions
GET    /transactions/:id     - Get transaction
POST   /transactions/transfer - Create transfer
GET    /transactions/reference/:ref - Lookup by reference

KYC:
GET    /kyc/status           - Get KYC status
GET    /kyc/documents        - List documents
GET    /kyc/documents/:id    - Get document
POST   /kyc/documents        - Upload document
POST   /kyc/upgrade          - Request tier upgrade

Notifications:
GET    /notifications        - List notifications
GET    /notifications/unread - List unread
GET    /notifications/unread/count - Unread count
GET    /notifications/:id    - Get notification
POST   /notifications/:id/read - Mark read
POST   /notifications/read-all - Mark all read
DELETE /notifications/:id    - Delete notification
```

---

## Configuration

### Environment Variables (.env)

```bash
# Application
NODE_ENV=development          # development | production | test
PORT=3001                     # Server port
API_PREFIX=api/v1            # API route prefix

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bankapp
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis (for sessions - not yet used)
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<64-char-secret>
JWT_REFRESH_SECRET=<64-char-secret>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Encryption (for BVN/NIN - not yet implemented)
ENCRYPTION_KEY=<32-byte-hex>

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# CORS
CORS_ORIGINS=http://localhost:3000
```

### TypeScript Path Aliases

```typescript
@config/   -> src/config/
@database/ -> src/database/
@common/   -> src/common/
@modules/  -> src/modules/
```

---

## Areas for Review/Revision

### 1. Transaction Processing ⚠️ HIGH PRIORITY

**Current State**: The transfer endpoint creates a transaction record but does NOT:
- Update account balances
- Use database transactions
- Verify transaction PIN
- Implement idempotency

**Needs**:
- Proper database transaction wrapping
- Balance updates with locking
- Transaction PIN verification step
- Idempotency key handling

### 2. Sensitive Data Encryption ⚠️ HIGH PRIORITY

**Current State**: BVN and NIN fields exist but encryption is not implemented.

**Needs**:
- AES-256-GCM encryption for BVN/NIN
- Encryption key management
- Secure key rotation strategy

### 3. Session Management

**Current State**: Sessions table exists but is not used. Tokens are stateless.

**Needs Decision**:
- Keep stateless JWT only? (simpler, but can't revoke tokens)
- Implement session tracking? (more complex, but better security)

### 4. Notification Delivery

**Current State**: Notifications are stored but not delivered.

**Needs**:
- Firebase Cloud Messaging integration (push)
- SendGrid/SES integration (email)
- Twilio/Africa's Talking integration (SMS)

### 5. File Upload

**Current State**: KYC expects a `fileUrl` but no upload endpoint exists.

**Needs**:
- File upload endpoint with S3/Cloudinary
- File validation (size, type, virus scan)
- Secure URL generation

### 6. OTP Verification

**Current State**: Not implemented.

**Needs**:
- OTP generation and verification
- For: email change, phone change, transaction confirmation
- Rate limiting on OTP requests

### 7. Account Number Generation

**Current State**: Account creation expects `accountNumber` to be provided.

**Needs**:
- Auto-generate unique account numbers
- Bank-specific format (e.g., 10 digits)
- Checksum validation

### 8. Audit Log Implementation

**Current State**: Schema exists, interceptor created, but not fully integrated.

**Needs**:
- Complete audit log entries for all operations
- Log retention policy
- Log search/export functionality

---

## Next Steps

### Immediate (Required for MVP)

1. **Implement balance updates** in transaction service
2. **Add transaction PIN verification** for transfers
3. **Implement file upload** for KYC documents
4. **Add OTP service** for sensitive operations

### Short Term

5. Set up database migrations with DrizzleORM
6. Add unit tests for services
7. Add integration tests for controllers
8. Implement notification delivery

### Medium Term

9. Add Redis for session management
10. Implement encryption for sensitive data
11. Add comprehensive audit logging
12. Set up CI/CD pipeline

---

## Running the Backend

### Development

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Install dependencies
npm install

# Run database migrations (after creating them)
npm run db:push

# Start development server
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

### Available Scripts

```bash
npm run start:dev    # Development with hot reload
npm run start:debug  # Debug mode
npm run start:prod   # Production mode
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
npm run db:generate  # Generate migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

---

## Questions for Review

1. **Authentication Method**: Is PIN-only sufficient, or do you need password + PIN?

2. **Tier Names**: Currently using 'basic', 'verified', 'premium', 'business'. Should these be 'tier1', 'tier2', 'tier3'?

3. **Transaction Types**: Current types include 'transfer', 'deposit', 'withdrawal', 'payment'. What other types are needed?

4. **Currency Support**: Currently supporting NGN, USD, GBP, EUR. Is this sufficient?

5. **Session Strategy**: Stateless JWT or session-based with Redis?

6. **Notification Channels**: Push, Email, SMS planned. Any others (WhatsApp, in-app only)?

7. **KYC Document Types**: Currently support BVN, government ID, passport, driver's license, utility bill, selfie. What else?

8. **Account Types**: Currently savings, current, fixed deposit, loan, investment. Is this complete?

---

*Document Version: 1.1*
*Last Updated: January 2025*

---

## Changelog

### v1.1 (January 2025)
- Added Qoreid Module documentation (digital identity verification)
- Updated module count from 6 to 8 (added Mail, Qoreid)
- Added Mail Module documentation with templates and usage examples
- Updated project structure to reflect new modules
