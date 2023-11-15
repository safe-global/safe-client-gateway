import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { verifyMessage } from 'viem';

/**
 * The OnlySafeOwner guard can be applied to any route that requires proof
 * that a request was signed by an owner of a Safe.
 *
 * This guard does not restrict the contents of the message, i.e.: any security
 * considerations are left to the route itself.
 *
 * To use this guard, the route should have:
 * - the 'chainId' declared as a parameter
 * - the 'safeAddress' declared as a parameter
 * - the 'signature' as part of the JSON body (top level)
 * - the 'message' as part of the JSON body (top level)
 * - the 'address' as part of the JSON body (top level)
 */
@Injectable()
export class OnlySafeOwner implements CanActivate {
  constructor(
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const chainId = request.params['chainId'];
    const safe = request.params['safeAddress'];
    const signature = request.body['signature'];
    const message = request.body['message'];
    const address = request.body['address'];

    // Required fields
    if (!chainId || !safe || !signature || !message || !address) return false;

    try {
      const isValidSignature = await verifyMessage({
        address,
        message,
        signature,
      });
      if (!isValidSignature) return false;
    } catch (e) {
      this.loggingService.debug(e);
      return false;
    }

    return await this.safeRepository.isOwner({
      chainId,
      safeAddress: safe,
      address: address,
    });
  }
}
