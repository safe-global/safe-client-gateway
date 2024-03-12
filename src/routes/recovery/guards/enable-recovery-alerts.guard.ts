import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { getAddress, verifyMessage } from 'viem';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

/**
 * The EnableRecoveryAlertsGuard guard should be used on routes that require
 * authenticated actions for enabling recovery alerts.
 *
 * This guard therefore validates if the message came from the specified signer.
 *
 * The following message should be signed:
 * enable-recovery-alerts-${chainId}-${safeAddress}-${moduleAddress}-${signer}-${timestamp}
 *
 * (where ${} represents placeholder values for the respective data)
 *
 * To use this guard, the route should have:
 * - the 'chainId' as part of the path parameters
 * - the 'safeAddress' as part of the path parameters
 * - the 'moduleAddress' as part of the JSON body (top level)
 * - the 'signer' as part of the JSON body (top level)
 * - the 'Safe-Wallet-Signature' header set to the signature
 * - the 'Safe-Wallet-Signature-Timestamp' header set to the signature timestamp
 */
@Injectable()
export class EnableRecoveryAlertsGuard implements CanActivate {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  private static readonly ACTION_PREFIX = 'enable-recovery-alerts';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safeAddress = request.params['safeAddress'];
    const moduleAddress = request.body['moduleAddress'];
    const signer = request.body['signer'];
    const signature = request.headers['safe-wallet-signature'];
    const timestamp = request.headers['safe-wallet-signature-timestamp'];

    // Required fields
    if (
      !chainId ||
      !safeAddress ||
      !moduleAddress ||
      !signer ||
      !signature ||
      !timestamp
    )
      return false;

    const message = `${EnableRecoveryAlertsGuard.ACTION_PREFIX}-${chainId}-${safeAddress}-${moduleAddress}-${signer}-${timestamp}`;

    try {
      const isValid = await verifyMessage({
        address: signer,
        message,
        signature,
      });

      if (!isValid) {
        return false;
      }

      const { safes } = await this.safeRepository.getSafesByModule({
        chainId,
        moduleAddress,
      });

      return safes.some((safe) => getAddress(safe) === getAddress(safeAddress));
    } catch (e) {
      this.loggingService.debug(e);
      return false;
    }
  }
}
