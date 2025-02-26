import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { TypedDataDefinition } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class MessageVerifierHelper {
  private readonly isMessageVerificationEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isMessageVerificationEnabled = this.configurationService.getOrThrow(
      'features.messageVerification',
    );
  }

  public verifyMessageHash(args: {
    chainId: string;
    safe: Safe;
    expectedHash: `0x${string}`;
    message: string | Record<string, unknown>;
  }): void {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    let calculatedHash;
    try {
      calculatedHash = getSafeMessageMessageHash({
        chainId: args.chainId,
        safe: args.safe,
        message: args.message as string | TypedDataDefinition,
      });
    } catch {
      throw new BadGatewayException('Could not calculate messageTxHash');
    }

    if (calculatedHash !== args.expectedHash) {
      throw new BadGatewayException('Invalid message hash');
    }
  }
}
