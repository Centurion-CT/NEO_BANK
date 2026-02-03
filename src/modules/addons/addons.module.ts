import { Module } from '@nestjs/common';
import { AddonsController } from './addons.controller';
import { AddonsService } from './addons.service';
import { AddonsRepository } from './addons.repository';

/**
 * Addons Module
 *
 * Handles addon management and user addon subscriptions
 * including ERP, Analytics, Payroll, and other business addons
 */
@Module({
  controllers: [AddonsController],
  providers: [AddonsService, AddonsRepository],
  exports: [AddonsService],
})
export class AddonsModule {}
