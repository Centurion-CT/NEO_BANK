import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';

import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';
import { TransferDto } from './dto/transfer.dto';
import { TransactionFiltersDto } from './dto/transaction-filters.dto';

/**
 * Transactions Controller
 * Fund transfer and transaction history endpoints
 */
@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Get transaction history
   */
  @Get()
  @ApiOperation({
    summary: 'Get transaction history',
    description: 'Returns transaction history for the authenticated user',
  })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() filters: TransactionFiltersDto,
  ) {
    const transactions = await this.transactionsService.getHistory(userId, {
      accountId: filters.accountId,
      type: filters.type,
      status: filters.status,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      limit: filters.limit,
      offset: filters.offset,
    });

    return transactions.map((txn) => ({
      id: txn.id,
      reference: txn.reference,
      type: txn.type,
      amount: txn.amount,
      currency: txn.currency,
      status: txn.status,
      description: txn.description,
      narration: txn.narration,
      sourceAccountId: txn.sourceAccountId,
      destinationAccountId: txn.destinationAccountId,
      createdAt: txn.createdAt,
      completedAt: txn.completedAt,
    }));
  }

  /**
   * Get transaction details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Returns details for a specific transaction',
  })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransaction(
    @CurrentUser('id') userId: string,
    @Param('id') transactionId: string,
  ) {
    const txn = await this.transactionsService.findById(transactionId, userId);
    return {
      id: txn.id,
      reference: txn.reference,
      type: txn.type,
      amount: txn.amount,
      currency: txn.currency,
      status: txn.status,
      description: txn.description,
      narration: txn.narration,
      sourceAccountId: txn.sourceAccountId,
      destinationAccountId: txn.destinationAccountId,
      balanceBefore: txn.balanceBefore,
      balanceAfter: txn.balanceAfter,
      fee: txn.fee,
      failureReason: txn.failureReason,
      createdAt: txn.createdAt,
      completedAt: txn.completedAt,
    };
  }

  /**
   * Initiate fund transfer
   */
  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Transfer funds',
    description: 'Initiate a fund transfer to another account',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer initiated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transfer request',
  })
  async transfer(
    @CurrentUser('id') userId: string,
    @Body() transferDto: TransferDto,
  ) {
    const transaction = await this.transactionsService.transfer(userId, {
      sourceAccountId: transferDto.sourceAccountId,
      destinationAccountNumber: transferDto.destinationAccountNumber,
      amount: transferDto.amount,
      currency: transferDto.currency,
      description: transferDto.description,
      narration: transferDto.narration,
    });

    return {
      id: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      message: 'Transfer initiated successfully',
    };
  }

  /**
   * Get transaction by reference
   */
  @Get('reference/:reference')
  @ApiOperation({
    summary: 'Get transaction by reference',
    description: 'Lookup transaction by reference number',
  })
  @ApiParam({ name: 'reference', description: 'Transaction reference' })
  @ApiResponse({
    status: 200,
    description: 'Transaction found',
  })
  async getByReference(
    @CurrentUser('id') userId: string,
    @Param('reference') reference: string,
  ) {
    const txn = await this.transactionsService.findByReference(reference);

    if (!txn || txn.identityId !== userId) {
      return { found: false };
    }

    return {
      found: true,
      transaction: {
        id: txn.id,
        reference: txn.reference,
        type: txn.type,
        amount: txn.amount,
        currency: txn.currency,
        status: txn.status,
        createdAt: txn.createdAt,
      },
    };
  }
}
