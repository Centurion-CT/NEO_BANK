import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DevicesRepository } from './devices.repository';
import { Device } from '@database/schemas';

export interface DeviceInfo {
  id: string;
  deviceFingerprint: string;
  deviceType: string;
  deviceName: string | null;
  deviceModel: string | null;
  osName: string | null;
  osVersion: string | null;
  isTrusted: boolean;
  trustedAt: Date | null;
  isBound: boolean;
  boundAt: Date | null;
  lastActiveAt: Date | null;
  lastIpAddress: string | null;
  createdAt: Date;
}

export interface RegisterDeviceOptions {
  identityId: string;
  deviceFingerprint: string;
  deviceType: 'web' | 'ios' | 'android' | 'desktop' | 'unknown';
  deviceName?: string;
  deviceModel?: string;
  osName?: string;
  osVersion?: string;
  appVersion?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Devices Service
 *
 * Manages device registration, binding, and trust for mobile apps.
 *
 * DEVICE BINDING:
 * - Only available for mobile apps (iOS/Android)
 * - When a device is bound, user can ONLY login from that device
 * - Only one device can be bound at a time
 * - Binding can be removed by the user (requires PIN verification)
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly devicesRepository: DevicesRepository) {}

  /**
   * Register or update a device
   */
  async registerDevice(options: RegisterDeviceOptions): Promise<Device> {
    const {
      identityId,
      deviceFingerprint,
      deviceType,
      deviceName,
      deviceModel,
      osName,
      osVersion,
      appVersion,
      userAgent,
      ipAddress,
    } = options;

    const device = await this.devicesRepository.upsert(identityId, deviceFingerprint, {
      deviceType,
      deviceName,
      deviceModel,
      osName,
      osVersion,
      appVersion,
      userAgent,
      lastIpAddress: ipAddress,
      lastActiveAt: new Date(),
    });

    this.logger.log(`Device registered/updated: ${device.id} for identity ${identityId}`);

    return device;
  }

  /**
   * Get all devices for an identity
   */
  async getDevices(identityId: string): Promise<DeviceInfo[]> {
    const devices = await this.devicesRepository.findByIdentityId(identityId);

    return devices.map((device) => ({
      id: device.id,
      deviceFingerprint: device.deviceFingerprint,
      deviceType: device.deviceType,
      deviceName: device.deviceName,
      deviceModel: device.deviceModel,
      osName: device.osName,
      osVersion: device.osVersion,
      isTrusted: device.isTrusted,
      trustedAt: device.trustedAt,
      isBound: device.isBound,
      boundAt: device.boundAt,
      lastActiveAt: device.lastActiveAt,
      lastIpAddress: device.lastIpAddress,
      createdAt: device.createdAt,
    }));
  }

  /**
   * Get the bound device for an identity (if any)
   */
  async getBoundDevice(identityId: string): Promise<Device | null> {
    return this.devicesRepository.findBoundDevice(identityId);
  }

  /**
   * Bind a device (mobile only)
   * This restricts login to only this device
   */
  async bindDevice(identityId: string, deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DEVICE_ACCESS_DENIED',
        message: 'Cannot bind another user\'s device',
      });
    }

    // Only allow binding for mobile devices
    if (device.deviceType !== 'ios' && device.deviceType !== 'android') {
      throw new BadRequestException({
        code: 'DEVICE_NOT_MOBILE',
        message: 'Device binding is only available for mobile devices (iOS/Android)',
      });
    }

    // Check if there's already a bound device
    const existingBound = await this.devicesRepository.findBoundDevice(identityId);
    if (existingBound && existingBound.id !== deviceId) {
      // Unbind the existing device first
      await this.devicesRepository.unbindDevice(existingBound.id);
      this.logger.log(`Unbound previous device ${existingBound.id} for identity ${identityId}`);
    }

    // Bind the new device
    const boundDevice = await this.devicesRepository.bindDevice(deviceId);

    this.logger.log(`Device ${deviceId} bound for identity ${identityId}`);

    return boundDevice;
  }

  /**
   * Unbind a device
   */
  async unbindDevice(identityId: string, deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DEVICE_ACCESS_DENIED',
        message: 'Cannot unbind another user\'s device',
      });
    }

    if (!device.isBound) {
      throw new BadRequestException({
        code: 'DEVICE_NOT_BOUND',
        message: 'Device is not bound',
      });
    }

    const unboundDevice = await this.devicesRepository.unbindDevice(deviceId);

    this.logger.log(`Device ${deviceId} unbound for identity ${identityId}`);

    return unboundDevice;
  }

  /**
   * Validate if a device is allowed to login
   * Returns true if allowed, throws exception if not
   */
  async validateDeviceForLogin(
    identityId: string,
    deviceFingerprint: string,
    deviceType: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Get bound device for this identity
    const boundDevice = await this.devicesRepository.findBoundDevice(identityId);

    // If no device is bound, allow login from any device
    if (!boundDevice) {
      return { allowed: true };
    }

    // If a device is bound, only allow login from that device
    if (boundDevice.deviceFingerprint === deviceFingerprint) {
      // Update last activity
      await this.devicesRepository.updateLastActivity(boundDevice.id, '');
      return { allowed: true };
    }

    // Device mismatch - login not allowed
    this.logger.warn(
      `Login attempt from unbound device for identity ${identityId}. ` +
      `Bound: ${boundDevice.deviceFingerprint}, Attempted: ${deviceFingerprint}`
    );

    return {
      allowed: false,
      reason: 'Your account is bound to a specific device. Please login from your bound device or unbind it first.',
    };
  }

  /**
   * Check if user has a bound device
   */
  async hasDeviceBinding(identityId: string): Promise<boolean> {
    const boundDevice = await this.devicesRepository.findBoundDevice(identityId);
    return !!boundDevice;
  }

  /**
   * Trust a device
   */
  async trustDevice(identityId: string, deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DEVICE_ACCESS_DENIED',
        message: 'Cannot trust another user\'s device',
      });
    }

    // Set trust expiry to 90 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    return this.devicesRepository.trustDevice(deviceId, expiresAt);
  }

  /**
   * Untrust a device
   */
  async untrustDevice(identityId: string, deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DEVICE_ACCESS_DENIED',
        message: 'Cannot untrust another user\'s device',
      });
    }

    return this.devicesRepository.untrustDevice(deviceId);
  }

  /**
   * Revoke a device
   */
  async revokeDevice(identityId: string, deviceId: string, reason?: string): Promise<Device> {
    const device = await this.devicesRepository.findById(deviceId);

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DEVICE_ACCESS_DENIED',
        message: 'Cannot revoke another user\'s device',
      });
    }

    return this.devicesRepository.revokeDevice(deviceId, reason);
  }

  /**
   * Find device by fingerprint
   */
  async findByFingerprint(identityId: string, fingerprint: string): Promise<Device | null> {
    return this.devicesRepository.findByFingerprint(identityId, fingerprint);
  }
}
