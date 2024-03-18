import { toSignableSiweMessage } from '@/datasources/auth-api/utils/to-signable-siwe-message';
import { SiweMessage } from '@/domain/auth/entities/siwe-message.entity';
import { IAuthApi } from '@/domain/interfaces/auth-api.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { verifyMessage } from 'viem';

@Injectable()
export class SiweApi implements IAuthApi {
  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  generateNonce(): string {
    // Minimum of 8 alphanumeric character
    return crypto.randomUUID().replace(/-/g, '');
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
