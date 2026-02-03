import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * Accounts Controller
 * Bank account management endpoints
 */
@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Get all user accounts
   */
  @Get()
  @ApiOperation({
    summary: 'Get all accounts',
    description: 'Returns all bank accounts for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Accounts retrieved successfully',
  })
  async getAccounts(@CurrentUser('id') userId: string) {
    const accounts = await this.accountsService.findByIdentityId(userId);
    return accounts.map((account: any) => ({
      id: account.id,
      accountId: account.accountId, // Core banking system ID
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      currency: account.currency,
      balance: account.balance,
      availableBalance: account.availableBalance,
      isPrimary: account.isPrimary,
      status: account.status,
      nickname: account.nickname,
      createdAt: account.createdAt,
    }));
  }

  /**
   * Get specific account
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get account details',
    description: 'Returns details for a specific account',
  })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({
    status: 200,
    description: 'Account retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found',
  })
  async getAccount(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    const account = await this.accountsService.findById(accountId, userId);
    return {
      id: account.id,
      accountId: account.accountId, // Core banking system ID
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      currency: account.currency,
      balance: account.balance,
      availableBalance: account.availableBalance,
      holdAmount: account.holdAmount,
      isPrimary: account.isPrimary,
      status: account.status,
      nickname: account.nickname,
      interestRate: account.interestRate,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Update account preferences
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update account',
    description: 'Update account preferences (nickname, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({
    status: 200,
    description: 'Account updated successfully',
  })
  async updateAccount(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
    @Body() updateAccountDto: UpdateAccountDto,
  ) {
    const account = await this.accountsService.update(
      accountId,
      userId,
      updateAccountDto,
    );
    return {
      id: account.id,
      nickname: account.nickname,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Set account as primary
   */
  @Patch(':id/set-primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set as primary account',
    description: 'Set this account as the primary account',
  })
  @ApiParam({ name: 'id', description: 'Account ID' })
  @ApiResponse({
    status: 200,
    description: 'Primary account updated',
  })
  async setPrimaryAccount(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
  ) {
    const account = await this.accountsService.setPrimary(accountId, userId);
    return {
      id: account.id,
      isPrimary: account.isPrimary,
      message: 'Primary account updated successfully',
    };
  }
}
