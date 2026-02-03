import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { KycDocument, NewKycDocument, kycDocuments } from '@database/schemas';

/**
 * KYC Repository
 *
 * Data access layer for KYC documents table.
 * Follows Repository Pattern for clean separation.
 */
@Injectable()
export class KycRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new KYC document record
   */
  async create(data: Omit<NewKycDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<KycDocument> {
    const [document] = await this.db
      .insert(kycDocuments)
      .values(data)
      .returning();
    return document;
  }

  /**
   * Find document by ID
   */
  async findById(id: string): Promise<KycDocument | null> {
    const [document] = await this.db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.id, id))
      .limit(1);
    return document || null;
  }

  /**
   * Find all documents for an identity
   */
  async findByIdentityId(identityId: string): Promise<KycDocument[]> {
    return this.db
      .select()
      .from(kycDocuments)
      .where(eq(kycDocuments.identityId, identityId))
      .orderBy(desc(kycDocuments.createdAt));
  }

  /**
   * Find documents by type for an identity
   */
  async findByIdentityIdAndType(
    identityId: string,
    documentType: string,
  ): Promise<KycDocument[]> {
    return this.db
      .select()
      .from(kycDocuments)
      .where(
        and(
          eq(kycDocuments.identityId, identityId),
          eq(kycDocuments.documentType, documentType),
        ),
      )
      .orderBy(desc(kycDocuments.createdAt));
  }

  /**
   * Find latest document by type for an identity
   */
  async findLatestByIdentityIdAndType(
    identityId: string,
    documentType: string,
  ): Promise<KycDocument | null> {
    const [document] = await this.db
      .select()
      .from(kycDocuments)
      .where(
        and(
          eq(kycDocuments.identityId, identityId),
          eq(kycDocuments.documentType, documentType),
        ),
      )
      .orderBy(desc(kycDocuments.createdAt))
      .limit(1);
    return document || null;
  }

  /**
   * Update document status
   */
  async updateStatus(
    id: string,
    status: string,
    reviewNotes?: string,
    reviewedBy?: string,
  ): Promise<KycDocument> {
    const updateData: Partial<KycDocument> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'verified' || status === 'rejected') {
      updateData.verifiedAt = new Date();
      updateData.reviewedBy = reviewedBy;
    }

    if (reviewNotes) {
      updateData.reviewNotes = reviewNotes;
    }

    const [document] = await this.db
      .update(kycDocuments)
      .set(updateData)
      .where(eq(kycDocuments.id, id))
      .returning();

    return document;
  }

  /**
   * Update document
   */
  async update(id: string, data: Partial<KycDocument>): Promise<KycDocument> {
    const [document] = await this.db
      .update(kycDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kycDocuments.id, id))
      .returning();
    return document;
  }

  /**
   * Find all documents with pagination
   */
  async findAll(limit: number, offset: number): Promise<KycDocument[]> {
    return this.db
      .select()
      .from(kycDocuments)
      .orderBy(desc(kycDocuments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count documents by status
   */
  async countByStatus(status: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(kycDocuments)
      .where(eq(kycDocuments.status, status));
    return result?.count ?? 0;
  }
}
