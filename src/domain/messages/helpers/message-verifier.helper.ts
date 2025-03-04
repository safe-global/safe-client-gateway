import { IConfigurationService } from '@/config/configuration.service.interface';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Message } from '@/domain/messages/entities/message.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  BadGatewayException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TypedDataDefinition } from 'viem';

@Injectable()
export class MessageVerifierHelper {
  private readonly isEthSignEnabled: boolean;
  private readonly isMessageVerificationEnabled: boolean;
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isEthSignEnabled =
      this.configurationService.getOrThrow('features.ethSign');
    this.isMessageVerificationEnabled = this.configurationService.getOrThrow(
      'features.messageVerification',
    );
    this.blocklist = this.configurationService.getOrThrow(
      'blockchain.blocklist',
    );
  }

  public verifyCreation(args: {
    chainId: string;
    safe: Safe;
    message: string | Record<string, unknown>;
    signature: `0x${string}`;
  }): void {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    // We can't verify the messageHash as we have no comparison hash

    let calculatedHash: `0x${string}`;
    try {
      calculatedHash = getSafeMessageMessageHash({
        chainId: args.chainId,
        safe: args.safe,
        message: args.message,
      });
    } catch {
      throw new UnprocessableEntityException('Could not calculate messageHash');
    }

    this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: calculatedHash,
      signature: args.signature,
    });
  }

  public verifyUpdate(args: {
    chainId: string;
    safe: Safe;
    message: Message;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    this.verifyMessageHash({
      chainId: args.chainId,
      safe: args.safe,
      message: args.message.message,
      expectedHash: args.messageHash,
    });

    this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

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
      throw new BadGatewayException('Could not calculate messageHash');
    }

    if (calculatedHash !== args.expectedHash) {
      throw new BadGatewayException('Invalid messageHash');
    }
  }

  public verifySignature(args: {
    safe: Safe;
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    const signature = new SafeSignature({
      hash: args.messageHash,
      signature: args.signature,
    });

    if (
      !this.isEthSignEnabled &&
      signature.signatureType === SignatureType.EthSign
    ) {
      throw new BadGatewayException('eth_sign is disabled');
    }

    const isBlocked = this.blocklist.includes(signature.owner);
    if (isBlocked) {
      throw new BadGatewayException('Unauthorized address');
    }

    const isOwner = args.safe.owners.includes(signature.owner);
    if (!isOwner) {
      throw new BadGatewayException('Invalid signature');
    }
  }
}
