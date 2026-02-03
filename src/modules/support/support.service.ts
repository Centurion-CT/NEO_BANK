import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { SupportRepository } from './support.repository';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { MailService } from '@modules/mail/mail.service';
import { IdentityService } from '@modules/identity/identity.service';
import { SupportRequest } from '@database/schemas';

/**
 * Support Service
 *
 * Business logic for support request operations.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly supportRepository: SupportRepository,
    private readonly mailService: MailService,
    private readonly identityService: IdentityService,
  ) {}

  /**
   * Create a new support request
   */
  async createRequest(identityId: string, dto: CreateSupportRequestDto): Promise<SupportRequest> {
    const request = await this.supportRepository.create({
      identityId,
      subject: dto.subject,
      message: dto.message,
      category: dto.category,
      status: 'open',
      priority: 'medium',
    });

    // Fire-and-forget confirmation email
    this.sendConfirmationEmail(identityId, request).catch((err) => {
      this.logger.error(`Failed to send support confirmation email for identity ${identityId}`, err.stack);
    });

    return request;
  }

  /**
   * Get paginated support requests for an identity
   */
  async getRequests(identityId: string, limit = 20, offset = 0): Promise<{ data: SupportRequest[]; total: number }> {
    const [data, total] = await Promise.all([
      this.supportRepository.findByIdentityId(identityId, limit, offset),
      this.supportRepository.countByIdentityId(identityId),
    ]);
    return { data, total };
  }

  /**
   * Get a single support request with ownership check
   */
  async getRequest(id: string, identityId: string): Promise<SupportRequest> {
    const request = await this.supportRepository.findById(id);

    if (!request) {
      throw new NotFoundException({
        code: 'SUPPORT_REQUEST_NOT_FOUND',
        message: 'Support request not found',
      });
    }

    if (request.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this support request',
      });
    }

    return request;
  }

  /**
   * Get count of identity's support requests
   */
  async getRequestCount(identityId: string): Promise<number> {
    return this.supportRepository.countByIdentityId(identityId);
  }

  /**
   * Find all support requests with pagination (admin)
   */
  async findAllRequests(limit: number, offset: number): Promise<{ data: SupportRequest[]; total: number }> {
    const [data, open, inProgress, resolved, closed] = await Promise.all([
      this.supportRepository.findAll(limit, offset),
      this.supportRepository.countByStatus('open'),
      this.supportRepository.countByStatus('in_progress'),
      this.supportRepository.countByStatus('resolved'),
      this.supportRepository.countByStatus('closed'),
    ]);
    return { data, total: open + inProgress + resolved + closed };
  }

  /**
   * Count support requests by status (admin)
   */
  async countByStatus(status: string): Promise<number> {
    return this.supportRepository.countByStatus(status);
  }

  /**
   * Send confirmation email after support request creation
   */
  private async sendConfirmationEmail(identityId: string, request: SupportRequest): Promise<void> {
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    if (!fullIdentity) return;

    const { personProfile, principals } = fullIdentity;
    const emailPrincipal = principals.find(p => p.principalType === 'email');
    if (!emailPrincipal) return;

    await this.mailService.sendEmail(
      emailPrincipal.principalValue,
      `Support Request Received - ${request.subject}`,
      'support-confirmation',
      {
        firstName: personProfile?.firstName || 'Customer',
        subject: request.subject,
        category: request.category,
        ticketId: `SR-${request.id.split('-')[0].toUpperCase()}`,
      },
    );
  }
}
