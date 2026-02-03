import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '@modules/audit/audit.service';
import { NewAuditLog } from '@database/schemas';

/**
 * Route-to-audit-action mapping.
 * Key format: "METHOD /path/pattern" (path after the global API prefix).
 * Use ":param" as a wildcard for route parameters.
 */
const ROUTE_ACTION_MAP: Record<string, { action: NewAuditLog['action']; resourceType?: string }> = {
  // Auth
  'POST /auth/register':      { action: 'user_create', resourceType: 'user' },
  'POST /auth/login':         { action: 'login_success', resourceType: 'session' },
  'POST /auth/logout':        { action: 'logout', resourceType: 'session' },
  'POST /auth/change-pin':    { action: 'pin_change', resourceType: 'user' },
  'POST /auth/mfa/enroll':    { action: 'mfa_enroll', resourceType: 'user' },
  'POST /auth/mfa/verify':    { action: 'mfa_verify', resourceType: 'user' },

  // Profile
  'PATCH /users/profile':     { action: 'profile_update', resourceType: 'user' },

  // Accounts
  'POST /accounts':           { action: 'account_create', resourceType: 'account' },
  'PATCH /accounts/:id':      { action: 'account_update', resourceType: 'account' },

  // Transactions
  'POST /transactions':             { action: 'transaction_initiate', resourceType: 'transaction' },
  'POST /transactions/transfer':    { action: 'transaction_initiate', resourceType: 'transaction' },

  // KYC
  'POST /kyc/documents':      { action: 'kyc_submit', resourceType: 'kyc' },
  'PATCH /admin/kyc/:id/review': { action: 'kyc_approve', resourceType: 'kyc' },

  // Sessions
  'DELETE /admin/sessions/:id':          { action: 'session_revoke', resourceType: 'session' },
  'DELETE /admin/sessions/user/:userId': { action: 'session_revoke', resourceType: 'session' },

  // Admin user management
  'PATCH /admin/users/:id/dob':    { action: 'admin_action', resourceType: 'user' },
  'PATCH /admin/users/:id/status': { action: 'admin_action', resourceType: 'user' },
  'POST /admin/admins':            { action: 'admin_action', resourceType: 'user' },

  // Device trust
  'POST /sessions/trust':     { action: 'device_trust', resourceType: 'session' },
  'DELETE /sessions/:id':     { action: 'session_revoke', resourceType: 'session' },
};

/**
 * Audit Log Interceptor
 * Logs all API requests for security auditing
 *
 * SECURITY NOTES:
 * - Masks sensitive data in logs
 * - Records request timing for anomaly detection
 * - Persists to audit_logs table via AuditService
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers, body } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = headers['x-request-id'] || this.generateRequestId();
    const startTime = Date.now();

    // Attach request ID for tracing
    request.headers['x-request-id'] = requestId;

    this.logger.log(
      `[${requestId}] → ${method} ${url} | IP: ${ip} | UA: ${userAgent.substring(0, 50)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${requestId}] ← ${method} ${url} | ${duration}ms | SUCCESS`,
          );
          this.persistAuditLog(request, requestId, 'success', undefined, duration);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `[${requestId}] ← ${method} ${url} | ${duration}ms | ERROR: ${error.message}`,
          );
          this.persistAuditLog(request, requestId, 'failed', error.message, duration);
        },
      }),
    );
  }

  /**
   * Persist the audit entry to the database.
   * Only logs write operations (POST/PUT/PATCH/DELETE) and failed login attempts.
   */
  private persistAuditLog(
    request: any,
    requestId: string,
    status: string,
    errorMessage: string | undefined,
    duration: number,
  ) {
    const { method, url, ip, headers, params, body } = request;
    const userAgent = headers['user-agent'] || 'unknown';

    // Skip GET requests — they're read-only and would flood the table
    if (method === 'GET') return;

    // Resolve the route path (strip the global API prefix)
    const routePath = this.extractRoutePath(url);
    const mapping = this.matchRoute(method, routePath);

    // Skip unmapped routes to avoid noise
    if (!mapping) return;

    let { action } = mapping;
    const { resourceType } = mapping;

    // Special case: login failures
    if (action === 'login_success' && status === 'failed') {
      action = 'login_failure';
    }

    // Special case: KYC review — distinguish approve vs reject
    if (routePath.includes('/admin/kyc/') && routePath.includes('/review')) {
      if (body?.status === 'rejected') action = 'kyc_reject';
      else action = 'kyc_approve';
    }

    const user = request.user;
    const resourceId = params?.id || params?.userId || undefined;
    const sanitizedBody = this.sanitizeBody(body);

    const entry: NewAuditLog = {
      userId: user?.id || undefined,
      userEmail: user?.email || undefined,
      adminId: user?.role === 'admin' ? user.id : undefined,
      action,
      resourceType,
      resourceId: resourceId || undefined,
      description: `${method} ${routePath}`,
      metadata: sanitizedBody ? { body: sanitizedBody, durationMs: duration } : { durationMs: duration },
      ipAddress: ip || undefined,
      userAgent,
      requestId,
      sessionId: undefined,
      status,
      errorMessage: errorMessage || undefined,
    };

    // Fire-and-forget — AuditService.log() already catches errors internally
    this.auditService.log(entry);
  }

  /**
   * Strip the global API prefix (e.g. "/api/v1") from the URL
   * and remove query strings.
   */
  private extractRoutePath(url: string): string {
    let path = url.split('?')[0];
    // Remove common API prefixes
    path = path.replace(/^\/api\/v\d+/, '');
    return path;
  }

  /**
   * Match a method + path against the route-action map.
   * Supports ":param" wildcards in the map keys.
   */
  private matchRoute(method: string, path: string): { action: NewAuditLog['action']; resourceType?: string } | null {
    // Try exact match first
    const exact = ROUTE_ACTION_MAP[`${method} ${path}`];
    if (exact) return exact;

    // Try pattern match with :param wildcards
    for (const [pattern, mapping] of Object.entries(ROUTE_ACTION_MAP)) {
      const [patternMethod, patternPath] = pattern.split(' ', 2);
      if (patternMethod !== method) continue;

      const regex = new RegExp(
        '^' + patternPath.replace(/:[^/]+/g, '[^/]+') + '$',
      );
      if (regex.test(path)) return mapping;
    }

    return null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = [
      'password',
      'pin',
      'transactionPin',
      'token',
      'refreshToken',
      'secret',
      'bvn',
      'nin',
      'cardNumber',
      'cvv',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    return sanitized;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
