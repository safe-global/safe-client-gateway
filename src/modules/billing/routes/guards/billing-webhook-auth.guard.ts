// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

/**
 * Protects the billing-service webhook endpoint with a service-to-service JWT.
 *
 * Extracts the `Authorization: Bearer <token>` credential (an HTTP concern) and
 * delegates verification to {@link BillingAuthService}. Only instantiated
 * when the `billingService` feature is enabled.
 */
@Injectable()
export class BillingWebhookAuthGuard implements CanActivate {
  constructor(private readonly tokenService: BillingAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();

    const token = this.getBearerToken(request);
    if (!token) {
      throw new UnauthorizedException(
        "No bearer token provided in 'Authorization' header",
      );
    }

    // Throws UnauthorizedException if the token is invalid or unauthorized.
    this.tokenService.verify(token);
    return true;
  }

  private getBearerToken(request: HttpRequest): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}
