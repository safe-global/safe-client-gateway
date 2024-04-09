import { toSignableSiweMessage } from '@/datasources/auth-api/utils/to-signable-siwe-message';
import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { verifyMessage } from 'viem';

@Injectable()
export class SiweApi implements IAuthApi {
  /**
   * This matches the entropy of the official SiWe implementation:
   *
   * > 96 bits has been chosen as a number to sufficiently balance size and security considerations
   * > relative to the lifespan of it's usage.
   *
   * const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
   * const length = Math.ceil(96 / (Math.log(ALPHANUMERIC.length) / Math.LN2))
   *
   * @see https://github.com/spruceid/siwe/blob/0e63b05cd3c722abd282dd1128aa8878648a8620/packages/siwe/lib/utils.ts#L36-L53
   * @see https://github.com/StableLib/stablelib/blob/5243520e343c217b6a751464dec1bc980cb510d8/packages/random/random.ts#L80-L99
   */

  private static readonly NONCE_LENGTH = 17;

  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Returns a string-based nonce of at least 8 alphanumeric characters
   * according to the EIP-4361 (SiWe) standard.
   *
   * @see https://eips.ethereum.org/EIPS/eip-4361#message-fields
   */
  generateNonce(): string {
    const randomValues = crypto.getRandomValues(
      new Uint8Array(SiweApi.NONCE_LENGTH),
    );

    return Array.from(randomValues, (byte) => {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async verifyMessage(args: {
    message: SiweMessage;
    signature: `0x${string}`;
  }): Promise<boolean> {
    const message = toSignableSiweMessage(args.message);
    try {
      return await verifyMessage({
        address: args.message.address,
        message,
        signature: args.signature,
      });
    } catch (e) {
      this.loggingService.debug(
        `Failed to verify SiWe message. message=${message}, error=${e}`,
      );
      return false;
    }
  }
}
