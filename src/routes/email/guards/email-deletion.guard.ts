import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { verifyMessage } from 'viem';

/**
 * The EmailDeletionGuard guard should be used on routes that require
 * authenticated actions for deleting email addresses.
 *
 * This guard therefore validates if the message came from the specified signer.
 *
 * The following message should be signed:
 * email-delete-${chainId}-${safe}-${emailAddress}-${signer}-${timestamp}
 *
 * (where ${} represents placeholder values for the respective data)
 *
 * To use this guard, the route should have:
 * - the 'chainId' as part of the path parameters
 * - the 'safeAddress' as part of the path parameters
 * - the 'signer' as part of the path parameters
 * - the 'Safe-Wallet-Signature' header set to the signature
 * - the 'Safe-Wallet-Signature-Timestamp' header set to the signature timestamp
 */
@Injectable()
export class EmailDeletionGuard implements CanActivate {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  private static readonly ACTION_PREFIX = 'email-delete';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safe = request.params['safeAddress'];
    const signer = request.params['signer'];
    const signature = request.headers['safe-wallet-signature'];
    const timestamp = request.headers['safe-wallet-signature-timestamp'];

    // Required fields
    if (!chainId || !safe || !signature || !signer || !timestamp) return false;

    const message = `${EmailDeletionGuard.ACTION_PREFIX}-${chainId}-${safe}-${signer}-${timestamp}`;

    try {
      return await verifyMessage({
        address: signer,
        message,
        signature,
      });
    } catch (e) {
      this.loggingService.debug(e);
      return false;
    }
  }
}
