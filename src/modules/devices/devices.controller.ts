import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DevicesService } from './devices.service';
import { SessionsService } from '@modules/sessions/sessions.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

class BindDeviceDto {
  deviceId: string;
}

class UnbindDeviceDto {
  deviceId: string;
}

@ApiTags('Devices')
@Controller('devices')
@UseGuards(ThrottlerGuard)
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Get all devices for the current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all devices for the current user' })
  @ApiResponse({ status: 200, description: 'List of devices' })
  async getDevices(@CurrentUser('id') userId: string) {
    const devices = await this.devicesService.getDevices(userId);
    return { devices };
  }

  /**
   * Get the currently bound device (if any)
   */
  @Get('bound')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently bound device' })
  @ApiResponse({ status: 200, description: 'Bound device info or null' })
  async getBoundDevice(@CurrentUser('id') userId: string) {
    const boundDevice = await this.devicesService.getBoundDevice(userId);
    return { boundDevice };
  }

  /**
   * Check if user has device binding enabled
   */
  @Get('binding-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user has device binding enabled' })
  @ApiResponse({ status: 200, description: 'Binding status' })
  async getBindingStatus(@CurrentUser('id') userId: string) {
    const hasBinding = await this.devicesService.hasDeviceBinding(userId);
    const boundDevice = hasBinding ? await this.devicesService.getBoundDevice(userId) : null;
    return {
      hasBinding,
      boundDevice: boundDevice ? {
        id: boundDevice.id,
        deviceType: boundDevice.deviceType,
        deviceName: boundDevice.deviceName,
        deviceModel: boundDevice.deviceModel,
        boundAt: boundDevice.boundAt,
      } : null,
    };
  }

  /**
   * Bind a device (mobile only)
   * This restricts login to only this device
   */
  @Post('bind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bind a device (mobile only) - restricts login to this device' })
  @ApiResponse({ status: 200, description: 'Device bound successfully' })
  @ApiResponse({ status: 400, description: 'Device is not a mobile device or already bound' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async bindDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: BindDeviceDto,
  ) {
    const device = await this.devicesService.bindDevice(userId, dto.deviceId);
    return {
      message: 'Device bound successfully. You can now only login from this device.',
      device: {
        id: device.id,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
        deviceModel: device.deviceModel,
        isBound: device.isBound,
        boundAt: device.boundAt,
      },
    };
  }

  /**
   * Unbind a device
   */
  @Post('unbind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unbind a device - allows login from any device' })
  @ApiResponse({ status: 200, description: 'Device unbound successfully' })
  @ApiResponse({ status: 400, description: 'Device is not bound' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async unbindDevice(
    @CurrentUser('id') userId: string,
    @Body() dto: UnbindDeviceDto,
  ) {
    const device = await this.devicesService.unbindDevice(userId, dto.deviceId);
    return {
      message: 'Device unbound successfully. You can now login from any device.',
      device: {
        id: device.id,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
        isBound: device.isBound,
      },
    };
  }

  /**
   * Trust a device
   */
  @Post(':deviceId/trust')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trust a device' })
  @ApiResponse({ status: 200, description: 'Device trusted successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async trustDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const device = await this.devicesService.trustDevice(userId, deviceId);
    return {
      message: 'Device trusted successfully',
      device: {
        id: device.id,
        isTrusted: device.isTrusted,
        trustedAt: device.trustedAt,
      },
    };
  }

  /**
   * Untrust a device
   */
  @Delete(':deviceId/trust')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove trust from a device' })
  @ApiResponse({ status: 200, description: 'Device untrusted successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async untrustDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const device = await this.devicesService.untrustDevice(userId, deviceId);
    return {
      message: 'Device untrusted successfully',
      device: {
        id: device.id,
        isTrusted: device.isTrusted,
      },
    };
  }

  /**
   * Revoke a device
   */
  @Delete(':deviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a device' })
  @ApiResponse({ status: 200, description: 'Device revoked successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async revokeDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const device = await this.devicesService.revokeDevice(userId, deviceId, 'User revoked device');
    return {
      message: 'Device revoked successfully',
      deviceId: device.id,
    };
  }

  /**
   * Get sessions for a specific device
   */
  @Get(':deviceId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent sessions for a device' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of sessions to return (default: 5)' })
  @ApiResponse({ status: 200, description: 'List of device sessions' })
  async getDeviceSessions(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.sessionsService.getDeviceSessions(
      userId,
      deviceId,
      limit ? parseInt(limit, 10) : 5,
    );
    return { sessions };
  }

  /**
   * Terminate all sessions for a device
   */
  @Delete(':deviceId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate all sessions for a device' })
  @ApiResponse({ status: 200, description: 'All device sessions terminated' })
  async terminateDeviceSessions(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    const count = await this.sessionsService.revokeAllDeviceSessions(userId, deviceId);
    return {
      message: `${count} session(s) terminated for this device`,
      terminatedCount: count,
    };
  }
}
