// SPDX-License-Identifier: FSL-1.1-MIT
import crypto from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

@Injectable()
export class TenderlySignatureGuard implements CanActivate {
  private static readonly SIGNATURE_HEADER = 'x-tenderly-signature';
  private static readonly TIMESTAMP_HEADER = 'date';

  private readonly signingKey: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.signingKey = this.configurationService.getOrThrow<string>(
      'alerts-route.signingKey',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();

    const signature = this.getSignature(request.headers);
    const digest = this.getDigest(request);

    return this.isValidSignature({ signature, digest });
  }

  private getSignature(headers: HttpRequest['headers']): string {
    const signature = headers[TenderlySignatureGuard.SIGNATURE_HEADER];

    if (typeof signature !== 'string') {
      throw Error('Invalid signature header');
    }

    return signature;
  }

  private getDigest(args: HttpRequest): string {
    const timestamp = args.headers[TenderlySignatureGuard.TIMESTAMP_HEADER];

    if (!timestamp) {
      throw Error('Timestamp header not found');
    }

    // Create a HMAC SHA256 hash using the signing key
    const hmac = crypto.createHmac('sha256', this.signingKey);
    // Update the hash with the request body using utf8
    hmac.update(JSON.stringify(args.body), 'utf8');
    // Update the hash with the request timestamp
    hmac.update(timestamp);

    return hmac.digest('hex');
  }

  private isValidSignature(args: {
    signature: string;
    digest: string;
  }): boolean {
    const signatureBuffer = Buffer.from(args.signature);
    const digestBuffer = Buffer.from(args.digest);

    try {
      return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
    } catch {
      return false;
    }
  }
}
