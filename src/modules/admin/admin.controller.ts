import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { AdminGuard } from '@common/guards/admin.guard';
import { AdminService } from './admin.service';
import { UpdateUserDobDto } from './dto/update-user-dob.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }

  @Get('users')
  async listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.listUsers(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Get('users/:id/business')
  async getUserBusiness(@Param('id') id: string) {
    return this.adminService.getBusinessProfile(id);
  }

  @Get('users/:id/principals')
  async getUserPrincipals(@Param('id') id: string) {
    return this.adminService.getBusinessPrincipals(id);
  }

  @Patch('users/:id/dob')
  async updateUserDob(
    @Param('id') id: string,
    @Body() dto: UpdateUserDobDto,
  ) {
    return this.adminService.updateUserDob(id, dto.dateOfBirth);
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto.status);
  }

  @Get('users/:id/lock-status')
  async getUserLockStatus(@Param('id') id: string) {
    return this.adminService.getUserLockStatus(id);
  }

  @Post('users/:id/unlock')
  async unlockUser(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.adminService.unlockUser(id, req.user.id);
  }

  @Get('kyc')
  async getKycQueue(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getKycQueue(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Patch('kyc/:id/review')
  async reviewKycDocument(
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
    @Request() req: any,
  ) {
    return this.adminService.reviewKycDocument(
      id,
      dto.status,
      dto.reviewNotes,
      req.user.id,
    );
  }

  // ============================================================================
  // KYC Profile Review Actions (GAP-008)
  // ============================================================================

  /**
   * Get KYC profiles pending review
   */
  @Get('kyc/profiles/pending')
  async getKycProfileReviewQueue(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.getKycProfileReviewQueue(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Request update from user - sends KYC back for corrections
   * Transition: PENDING_REVIEW → IN_PROGRESS
   */
  @Post('kyc/review/:identityId/request-update')
  async requestKycUpdate(
    @Param('identityId') identityId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.adminService.requestKycProfileUpdate(
      identityId,
      req.user.id,
      reason,
    );
  }

  /**
   * Reject KYC profile
   * Transition: PENDING_REVIEW → REJECTED
   */
  @Post('kyc/review/:identityId/reject')
  async rejectKycProfile(
    @Param('identityId') identityId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.adminService.rejectKycProfile(
      identityId,
      req.user.id,
      reason,
    );
  }

  /**
   * Approve KYC profile
   * Transition: PENDING_REVIEW → APPROVED
   * Triggers auto role assignment for business accounts
   */
  @Post('kyc/review/:identityId/approve')
  async approveKycProfile(
    @Param('identityId') identityId: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    return this.adminService.approveKycProfile(
      identityId,
      req.user.id,
      notes,
    );
  }

  @Get('support')
  async listSupportRequests(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.listSupportRequests(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('sessions')
  async listSessions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.listSessions(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Delete('sessions/:id')
  async terminateSession(@Param('id') id: string) {
    await this.adminService.terminateSession(id);
    return { message: 'Session terminated' };
  }

  @Delete('sessions/user/:userId')
  async terminateAllUserSessions(@Param('userId') userId: string) {
    await this.adminService.terminateAllUserSessions(userId);
    return { message: 'All sessions terminated' };
  }

  @Get('audit/stats')
  async getAuditStats() {
    return this.adminService.getAuditStats();
  }

  @Get('audit')
  async listAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.listAuditLogs({
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      action: action || undefined,
      status: status || undefined,
      userId: userId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }

  @Post('admins')
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }
}
