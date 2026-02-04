import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { IdentityService } from '@modules/identity/identity.service';

/**
 * KYC Profile Lock Guard
 *
 * Prevents profile updates when KYC status is 'pending_review'.
 * Used to enforce that users cannot edit their profile while
 * their KYC submission is being reviewed by compliance.
 *
 * Returns 403 Forbidden with PROFILE_LOCKED error code.
 */
@Injectable()
export class KycProfileLockGuard implements CanActivate {
  constructor(
    @Inject(IdentityService)
    private readonly identityService: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      // No user in request, let other guards handle auth
      return true;
    }

    const identityId = user.id;

    // Get KYC profile to check status
    const kycProfile = await this.identityService.getKycProfile(identityId);

    // If no KYC profile exists, allow the request (profile not yet started)
    if (!kycProfile) {
      return true;
    }

    // Block updates when KYC is pending review
    const lockedStatuses = ['pending_review'];

    if (lockedStatuses.includes(kycProfile.status)) {
      throw new ForbiddenException({
        code: 'PROFILE_LOCKED',
        message: 'Profile is locked during KYC review. Please wait for the review to complete.',
        status: kycProfile.status,
      });
    }

    return true;
  }
}
