import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { TypedDataDefinition } from 'viem';

@Injectable()
export class MessageVerifierHelper {
  public verifyMessageHash(args: {
    chainId: string;
    safe: Safe;
    expectedHash: `0x${string}`;
    message: string | Record<string, unknown>;
  }): void {
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
