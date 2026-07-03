// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingAuthService } from '@/modules/billing/domain/billing-auth.service';

/**
 * Protects the billing-service webhook endpoint with a service-to-service JWT.
 *
 * Extracts the `Authorization: Bearer <token>` credential (an HTTP concern) and
 * delegates verification to {@link BillingAuthService}. Only instantiated
 * when the `billingWebhook` feature is enabled.
 */
@Injectable()
export class BillingWebhookAuthGuard implements CanActivate {
  constructor(private readonly tokenService: BillingAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();

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

  private getBearerToken(request: Request): string | null {
    const AUTH_HEADER_NAME = 'authorization';
    const header = request.headers[AUTH_HEADER_NAME];
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}
