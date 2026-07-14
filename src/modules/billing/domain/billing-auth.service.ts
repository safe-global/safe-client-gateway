// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { derToJose } from 'ecdsa-sig-formatter';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JWT_ES_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import { jwtClientFactory } from '@/datasources/jwt/jwt.module';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT } from '@/modules/billing/domain/billing-auth.constants';
import {
  type BillingServiceToken,
  BillingServiceTokenSchema,
  SERVICE_ACCESS_PERMISSION_TYPE,
  SERVICE_ACCESS_ROLE,
  SERVICE_USER_TYPE,
} from '@/modules/billing/domain/entities/billing-service-token.entity';
import type { BillingTokenClaims } from '@/modules/billing/domain/entities/billing-token-claims.entity';

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
 * Only instantiated when the `billingService` feature is enabled (the module is
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
    this.publicKey = configurationService.getOrThrow<string>(
      'billing.webhook.publicKey',
    );
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
   * Builds the canonical claim set (single source of truth for both mint paths).
   * `iat`/`exp` are `Date`s here; they are converted to second-based NumericDates
   * when the token is signed.
   */
  private static buildClaims(args: BillingTokenClaims): {
    iss: string;
    sub: string;
    aud: Array<string>;
    iat: Date;
    exp: Date;
    roles: Array<string>;
    data: {
      service_name: string;
      permission_type: string;
      user_type: string;
    };
  } {
    const subject = args.subject ?? DEFAULT_BILLING_SERVICE_TOKEN_SUBJECT;
    const now = args.now ?? new Date();
    const exp = new Date(
      now.getTime() + args.expiresInDays * 24 * 60 * 60 * 1_000, // (now + days × 24h)
    );

    return {
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
  }

  /**
   * Mints the long-lived ES256 service token by signing with a **local** private
   * key. Pure/static — the private key is supplied by the caller, so this runs
   * from the CLI without booting the app.
   */
  static mint(args: BillingTokenClaims & { privateKey: string }): string {
    const client = jwtClientFactory();
    const token = client.sign(BillingAuthService.buildClaims(args), {
      secretOrPrivateKey: args.privateKey,
      algorithm: JWT_ES_ALGORITHM,
    });

    // Self-check: a freshly minted token must satisfy the authorization schema.
    BillingServiceTokenSchema.parse(client.decodeWithoutVerification(token));

    return token;
  }

  /**
   * Mints an ES256 service token whose signing is delegated to AWS KMS: the
   * private key stays in KMS and `sign` calls KMS `Sign`. Because KMS can't
   * produce a JWS itself, the token is assembled here by hand.
   *
   * @param args - Token claim inputs (issuer, subject, expiry).
   * @param sign - Given the JWS signing input (`base64url(header).base64url(payload)`),
   *   returns the DER-encoded ECDSA signature (the format KMS `Sign` returns).
   * @returns The signed compact JWS (`header.payload.signature`).
   */
  static async mintViaSigner(
    args: BillingTokenClaims,
    sign: (signingInput: Buffer) => Promise<Buffer>,
  ): Promise<string> {
    const claims = BillingAuthService.buildClaims(args);
    const header = { alg: JWT_ES_ALGORITHM, typ: 'JWT' };
    // Second-based NumericDate claims, matching the local sign path.
    const payload = {
      ...claims,
      iat: toSecondsTimestamp(claims.iat),
      exp: toSecondsTimestamp(claims.exp),
    };

    const signingInput = `${BillingAuthService.encodeSegment(header)}.${BillingAuthService.encodeSegment(payload)}`;
    const der = await sign(Buffer.from(signingInput));
    // KMS returns a DER ECDSA signature; JWS/ES256 needs raw R||S (base64url).
    const signature = derToJose(der, JWT_ES_ALGORITHM);
    const token = `${signingInput}.${signature}`;

    // This path hand-assembles the JWS (manual base64url + DER→JOSE), so decode
    // it back and parse the claims — this catches assembly mistakes and
    // guarantees the token satisfies the guard's authorization schema before
    // it's provisioned.
    BillingServiceTokenSchema.parse(
      jwtClientFactory().decodeWithoutVerification(token),
    );

    return token;
  }

  private static encodeSegment(segment: object): string {
    return Buffer.from(JSON.stringify(segment)).toString('base64url');
  }
}
