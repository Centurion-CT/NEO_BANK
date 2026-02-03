import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditLog, NewAuditLog } from '@database/schemas';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  /**
   * Create an audit log entry
   */
  async log(data: NewAuditLog): Promise<AuditLog> {
    try {
      return await this.auditRepository.create(data);
    } catch (error) {
      // Never let audit logging break the main flow
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      return null as any;
    }
  }

  /**
   * List audit logs with pagination and filters (admin)
   */
  async findAll(options: {
    limit: number;
    offset: number;
    action?: string;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const filterOpts = {
      limit: options.limit,
      offset: options.offset,
      action: options.action,
      status: options.status,
      userId: options.userId,
      startDate: options.startDate ? new Date(options.startDate) : undefined,
      endDate: options.endDate ? new Date(options.endDate) : undefined,
    };

    const [data, total] = await Promise.all([
      this.auditRepository.findFiltered(filterOpts),
      this.auditRepository.countFiltered(filterOpts),
    ]);

    return { data, total };
  }

  /**
   * Get audit stats (admin)
   */
  async getStats() {
    const [total, success, failed, security] = await Promise.all([
      this.auditRepository.countAll(),
      this.auditRepository.countByStatus('success'),
      this.auditRepository.countByStatus('failed'),
      this.auditRepository.countSecurityEvents(),
    ]);
    return { total, successful: success, failed, security };
  }

  /**
   * Get a single audit log entry by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    return this.auditRepository.findById(id);
  }
}
