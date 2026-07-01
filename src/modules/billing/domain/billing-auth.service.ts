// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  type BillingServiceToken,
  BillingServiceTokenSchema,
  SERVICE_ACCESS_PERMISSION_TYPE,
  SERVICE_ACCESS_ROLE,
  SERVICE_USER_TYPE,
} from '@/modules/billing/domain/entities/billing-service-token.entity';

export const DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT = 'billing-service';

/**
 * Owns the billing-service webhook credential lifecycle — the "receiver issues
 * the credential it later checks" model, where the CGW both mints the token and
 * verifies it.
 *
 * - {@link mint} (static) signs a long-lived ES256 token with the CGW **private**
 *   key. Used by the provisioning CLI (`scripts/generate-token.ts`); the
 *   private key is passed in by the caller and is never read from app config.
 * - {@link verify} validates an incoming token against the CGW **public** key and
 *   the service-token authorization markers.
 *
 * Only instantiated when the `billingWebhook` feature is enabled (the module is
 * gated in `AppModule`), so the public key is expected to be provisioned; a
 * missing key therefore fails fast at boot.
 */
@Injectable()
export class BillingAuthService {
  private readonly publicKey: string;
  private readonly issuer: string;

  constructor(
    @Inject(IJwtService) private readonly jwtService: IJwtService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.publicKey = configurationService
      .getOrThrow<string>('billing.webhook.publicKey')
      // PEM keys provided via env often arrive with escaped newlines.
      .replace(/\\n/g, '\n');
    this.issuer = configurationService.getOrThrow<string>(
      'billing.webhook.issuer',
    );
  }

  /**
   * Verifies an incoming bearer token in two layers:
   *   1. Cryptographic/standard claims — ES256 signature against the CGW public
   *      key, plus `iss`, `aud` and `exp`.
   *   2. Authorization — confirm it is a service token.
   */
  verify(token: string): BillingServiceToken {
    try {
      // Layer 1: signature + standard claims.
      const payload = this.jwtService.verify<BillingServiceToken>(token, {
        secretOrPrivateKey: this.publicKey,
        algorithms: [JWT_ES_ALGORITHM],
        issuer: this.issuer,
        audience: this.issuer,
      });

      // Layer 2: authorization markers.
      return BillingServiceTokenSchema.parse(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.loggingService.warn(
          `Billing webhook: token authorization failed: ${error.message}`,
        );
      } else {
        this.loggingService.warn(
          `Billing webhook: token verification failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
      throw new UnauthorizedException();
    }
  }

  /**
   * Mints the long-lived ES256 service token the CGW provisions to the billing
   * service. Pure/static — the private key is supplied by the caller, so this
   * runs from the CLI without booting the app.
   */
  static mint(args: {
    privateKey: string;
    issuer: string;
    expiresInDays: number;
    subject?: string;
    /** Injectable clock for deterministic tests. */
    now?: Date;
  }): string {
    const subject = args.subject ?? DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT;
    const now = args.now ?? new Date();
    const exp = new Date(
      now.getTime() + args.expiresInDays * 24 * 60 * 60 * 1_000, // (now + days × 24h)
    );

    const claims = {
      iss: args.issuer,
      sub: subject,
      aud: [args.issuer],
      iat: now,
      exp,
      roles: [SERVICE_ACCESS_ROLE],
      data: {
        service_name: subject,
        permission_type: SERVICE_ACCESS_PERMISSION_TYPE,
        user_type: SERVICE_USER_TYPE,
      },
    };

    const client = jwtClientFactory();
    const token = client.sign(claims, {
      secretOrPrivateKey: args.privateKey,
      algorithm: JWT_ES_ALGORITHM,
    });

    // Self-check: a freshly minted token must satisfy the authorization schema.
    BillingServiceTokenSchema.parse(client.decodeWithoutVerification(token));

    return token;
  }
}
