import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportRepository } from './support.repository';
import { IdentityModule } from '@modules/identity/identity.module';

/**
 * Support Module
 *
 * Handles:
 * - Support request CRUD
 * - Ticket management
 *
 * MailModule is @Global so no explicit import needed.
 */
@Module({
  imports: [IdentityModule],
  controllers: [SupportController],
  providers: [SupportService, SupportRepository],
  exports: [SupportService],
})
export class SupportModule {}
