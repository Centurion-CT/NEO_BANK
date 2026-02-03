import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // =====================
  // ROLES
  // =====================

  @Get('roles')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all roles' })
  @ApiResponse({ status: 200, description: 'List of all roles' })
  async findAllRoles() {
    const roles = await this.permissionsService.findAllRoles();
    return { roles };
  }

  @Get('roles/active')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all active roles' })
  @ApiResponse({ status: 200, description: 'List of active roles' })
  async findActiveRoles() {
    const roles = await this.permissionsService.findActiveRoles();
    return { roles };
  }

  @Get('roles/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role details' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findRoleById(@Param('id') id: string) {
    const role = await this.permissionsService.findRoleById(id);
    return { role };
  }

  @Get('roles/:id/permissions')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get role with permissions' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role with permissions' })
  async getRoleWithPermissions(@Param('id') id: string) {
    return this.permissionsService.getRoleWithPermissions(id);
  }

  @Post('roles')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new role (super_admin only)' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 409, description: 'Role already exists' })
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.permissionsService.createRole(dto);
    return { message: 'Role created successfully', role };
  }

  @Patch('roles/:id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update a role (super_admin only)' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.permissionsService.updateRole(id, dto);
    return { message: 'Role updated successfully', role };
  }

  @Delete('roles/:id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a role (super_admin only)' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Param('id') id: string) {
    await this.permissionsService.deleteRole(id);
    return { message: 'Role deleted successfully' };
  }

  // =====================
  // PERMISSIONS
  // =====================

  @Get('permissions')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all permissions' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'List of all permissions' })
  async findAllPermissions(@Query('category') category?: string) {
    const permissions = category
      ? await this.permissionsService.findPermissionsByCategory(category)
      : await this.permissionsService.findAllPermissions();
    return { permissions };
  }

  @Post('permissions')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new permission (super_admin only)' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  @ApiResponse({ status: 409, description: 'Permission already exists' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    const permission = await this.permissionsService.createPermission(dto);
    return { message: 'Permission created successfully', permission };
  }

  // =====================
  // ROLE PERMISSIONS
  // =====================

  @Post('roles/:roleId/permissions/:permissionId')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign permission to role (super_admin only)' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission assigned to role' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  async assignPermissionToRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.permissionsService.assignPermissionToRole(roleId, permissionId);
    return { message: 'Permission assigned to role successfully' };
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove permission from role (super_admin only)' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({ status: 200, description: 'Permission removed from role' })
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.permissionsService.removePermissionFromRole(roleId, permissionId);
    return { message: 'Permission removed from role successfully' };
  }

  // =====================
  // USER ROLES
  // =====================

  @Post('users/:userId/roles/:roleId')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role assigned to user' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('id') currentUserId: string,
    @Body() body?: { expiresAt?: string },
  ) {
    const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : undefined;
    await this.permissionsService.assignRoleToIdentity(userId, roleId, currentUserId, expiresAt);
    return { message: 'Role assigned to user successfully' };
  }

  @Delete('users/:userId/roles/:roleId')
  @Roles('super_admin', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role removed from user' })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.permissionsService.removeRoleFromIdentity(userId, roleId);
    return { message: 'Role removed from user successfully' };
  }

  @Get('users/:userId/roles')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User roles' })
  async getUserRoles(@Param('userId') userId: string) {
    const roles = await this.permissionsService.getIdentityRoles(userId);
    return { roles };
  }

  @Get('users/:userId/permissions')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user permissions' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User permissions' })
  async getUserPermissions(@Param('userId') userId: string) {
    const permissions = await this.permissionsService.getIdentityPermissions(userId);
    return { permissions };
  }

  // =====================
  // CURRENT USER
  // =====================

  @Get('me/roles')
  @ApiOperation({ summary: 'Get current user roles' })
  @ApiResponse({ status: 200, description: 'Current user roles' })
  async getMyRoles(@CurrentUser('id') userId: string) {
    const roles = await this.permissionsService.getIdentityRoles(userId);
    return { roles };
  }

  @Get('me/permissions')
  @ApiOperation({ summary: 'Get current user permissions' })
  @ApiResponse({ status: 200, description: 'Current user permissions' })
  async getMyPermissions(@CurrentUser('id') userId: string) {
    const permissions = await this.permissionsService.getIdentityPermissions(userId);
    return { permissions };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user roles and permissions' })
  @ApiResponse({ status: 200, description: 'Current user roles and permissions' })
  async getMyRolesAndPermissions(@CurrentUser('id') userId: string) {
    return this.permissionsService.getIdentityRolesWithPermissions(userId);
  }

  // =====================
  // SCOPED IDENTITY ROLES (NEW RBAC)
  // =====================

  @Post('identity-roles')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a scoped role to an identity' })
  @ApiResponse({ status: 200, description: 'Scoped role assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid scope or role already assigned' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async assignScopedRole(
    @Body() body: {
      identityId: string;
      roleId: string;
      scope: 'GLOBAL' | 'TENANT' | 'PROPERTY';
      scopeRefId?: string;
      expiresAt?: string;
    },
    @CurrentUser('id') currentUserId: string,
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    await this.permissionsService.assignScopedRoleToIdentity(
      body.identityId,
      body.roleId,
      body.scope,
      body.scopeRefId || null,
      currentUserId,
      expiresAt,
    );
    return { message: 'Scoped role assigned successfully' };
  }

  @Post('identity-roles/revoke')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a scoped role from an identity' })
  @ApiResponse({ status: 200, description: 'Scoped role revoked successfully' })
  @ApiResponse({ status: 404, description: 'Role assignment not found' })
  async revokeScopedRole(
    @Body() body: {
      identityId: string;
      roleId: string;
      scope: 'GLOBAL' | 'TENANT' | 'PROPERTY';
      scopeRefId?: string;
    },
  ) {
    await this.permissionsService.revokeScopedRoleFromIdentity(
      body.identityId,
      body.roleId,
      body.scope,
      body.scopeRefId || null,
    );
    return { message: 'Scoped role revoked successfully' };
  }

  @Get('identities/:identityId/scoped-roles')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get all scoped roles for an identity' })
  @ApiParam({ name: 'identityId', description: 'Identity ID' })
  @ApiQuery({ name: 'scope', required: false, description: 'Filter by scope' })
  @ApiQuery({ name: 'scopeRefId', required: false, description: 'Filter by scope reference ID' })
  @ApiResponse({ status: 200, description: 'List of scoped roles' })
  async getIdentityScopedRoles(
    @Param('identityId') identityId: string,
    @Query('scope') scope?: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    @Query('scopeRefId') scopeRefId?: string,
  ) {
    let roles;
    if (scope) {
      roles = await this.permissionsService.getIdentityRolesInScope(
        identityId,
        scope,
        scopeRefId || null,
      );
    } else {
      roles = await this.permissionsService.getIdentityScopedRoles(identityId);
    }
    return { roles };
  }
}
