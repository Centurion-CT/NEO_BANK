import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from '@modules/identity/identity.service';
import { PermissionsService } from '@modules/permissions/permissions.service';

interface JwtPayload {
  sub: string;
  email: string;
  type: string;
  iat: number;
  exp: number;
}

/**
 * JWT Strategy for Passport
 *
 * Uses the new identity/authentication compliance model:
 * - Identities: Root identity object
 * - PersonProfiles: User profile data
 * - AuthPrincipals: Login identifiers
 *
 * SECURITY NOTES:
 * - Only accepts tokens from Authorization header
 * - Validates token signature and expiration
 * - Verifies identity exists and is active
 * - Includes user roles from RBAC system
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly identityService: IdentityService,
    private readonly permissionsService: PermissionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify token type
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Fetch identity and verify status
    const fullIdentity = await this.identityService.getFullIdentity(payload.sub);

    if (!fullIdentity) {
      throw new UnauthorizedException('User not found');
    }

    const { identity, personProfile, kycProfile, principals } = fullIdentity;

    if (identity.status === 'suspended' || identity.status === 'closed') {
      throw new UnauthorizedException('Account is not active');
    }

    // Get identity roles from legacy userRoles table
    const legacyRoles = await this.permissionsService.getIdentityRoles(identity.id);
    const legacyRoleTypes = legacyRoles.map((r: any) => r.type).filter((t: any) => t !== null) as string[];

    // Get identity roles from new identityRoles table (scoped roles)
    const scopedRoles = await this.permissionsService.getIdentityScopedRoles(identity.id);
    const scopedRoleTypes = scopedRoles
      .map((sr: any) => {
        // Map roleCode to type for consistent handling
        if (sr.role.roleCode === 'ADMIN' || sr.role.roleCode === 'SUPER_ADMIN') return 'admin';
        if (sr.role.roleCode === 'SUPPORT_AGENT') return 'support_agent';
        return sr.role.type || sr.role.roleCode?.toLowerCase() || null;
      })
      .filter((t: any) => t !== null) as string[];

    // Merge and deduplicate role types
    const roleTypes = [...new Set([...legacyRoleTypes, ...scopedRoleTypes])];

    // Default role if no RBAC roles assigned
    if (roleTypes.length === 0) {
      roleTypes.push('user');
    }

    // Get email from principals
    const emailPrincipal = principals.find(p => p.principalType === 'email');

    // Return identity payload (attached to request.user)
    return {
      id: identity.id,
      email: emailPrincipal?.principalValue || payload.email,
      status: identity.status,
      tier: kycProfile?.kycTier || 'tier_0',
      type: identity.identityType,
      role: roleTypes[0], // Primary role for backwards compatibility
      roles: roleTypes,
    };
  }
}
