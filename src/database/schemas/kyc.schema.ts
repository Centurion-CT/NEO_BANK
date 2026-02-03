import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * KYC Status Enum
 */
export const kycStatusEnum = pgEnum('kyc_status', [
  'not_started',
  'pending',
  'processing',
  'verified',
  'rejected',
  'expired',
]);

/**
 * Document Type Enum
 */
export const documentTypeEnum = pgEnum('document_type', [
  'bvn',
  'national_id',
  'government_id',
  'passport',
  'drivers_license',
  'voters_card',
  'address_proof',
  'utility_bill',
  'bank_statement',
  'selfie',
  'signature',
  // Business document types
  'cac_certificate',
  'memart',
  'business_utility_bill',
]);

/**
 * Document Status Enum
 */
export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'verified',
  'rejected',
  'expired',
]);

/**
 * KYC Documents Table
 * Identity verification documents
 *
 * SECURITY NOTES:
 * - File URLs should point to encrypted storage
 * - Documents expire and require re-verification
 * - All access is logged
 */
export const kycDocuments = pgTable(
  'kyc_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id),

    // Document Info
    documentType: varchar('document_type', { length: 50 }).notNull(),
    documentNumber: varchar('document_number', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),

    // File Storage (encrypted S3/blob URL)
    fileUrl: text('file_url').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: integer('file_size').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),

    // Verification
    verifiedAt: timestamp('verified_at'),
    reviewedBy: uuid('reviewed_by'),
    reviewNotes: text('review_notes'),

    // Expiry
    expiryDate: timestamp('expiry_date'),

    // Metadata
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('kyc_documents_identity_id_idx').on(table.identityId),
    statusIdx: index('kyc_documents_status_idx').on(table.status),
    typeIdx: index('kyc_documents_type_idx').on(table.documentType),
  }),
);

// Relations
export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  identity: one(identities, {
    fields: [kycDocuments.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type KycDocument = typeof kycDocuments.$inferSelect;
export type NewKycDocument = typeof kycDocuments.$inferInsert;
