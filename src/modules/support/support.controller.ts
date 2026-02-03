import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { SupportService } from './support.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';

/**
 * Support Controller
 * Support request endpoints
 */
@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * Create a new support request
   */
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create support request',
    description: 'Submit a new support request',
  })
  @ApiResponse({ status: 201, description: 'Support request created' })
  async createRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSupportRequestDto,
  ) {
    return this.supportService.createRequest(userId, dto);
  }

  /**
   * List user's support requests
   */
  @Get('requests')
  @ApiOperation({
    summary: 'List support requests',
    description: 'Get paginated list of user support requests',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Support requests retrieved' })
  async getRequests(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.supportService.getRequests(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Get a single support request
   */
  @Get('requests/:id')
  @ApiOperation({
    summary: 'Get support request',
    description: 'Get details of a specific support request',
  })
  @ApiResponse({ status: 200, description: 'Support request retrieved' })
  async getRequest(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supportService.getRequest(id, userId);
  }
}
