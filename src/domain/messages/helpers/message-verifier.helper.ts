import { IConfigurationService } from '@/config/configuration.service.interface';
import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Message } from '@/domain/messages/entities/message.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  BadGatewayException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { recoverAddress, TypedDataDefinition } from 'viem';

@Injectable()
export class MessageVerifierHelper {
  private readonly isMessageVerificationEnabled: boolean;
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isMessageVerificationEnabled = this.configurationService.getOrThrow(
      'features.messageVerification',
    );
    this.blocklist = this.configurationService.getOrThrow(
      'blockchain.blocklist',
    );
  }

  public async verifyCreation(args: {
    chainId: string;
    safe: Safe;
    message: string | Record<string, unknown>;
    signature: `0x${string}`;
  }): Promise<void> {
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

    await this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: calculatedHash,
      signature: args.signature,
    });
  }

  public async verifyUpdate(args: {
    chainId: string;
    safe: Safe;
    message: Message;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<void> {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    this.verifyMessageHash({
      chainId: args.chainId,
      safe: args.safe,
      message: args.message.message,
      expectedHash: args.messageHash,
    });

    await this.verifySignature({
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

  public async verifySignature(args: {
    safe: Safe;
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<void> {
    const signerAddress = await this.recoverSignerAddress({
      messageHash: args.messageHash,
      signature: args.signature,
    });

    const isBlocked = this.blocklist.includes(signerAddress);
    if (isBlocked) {
      throw new BadGatewayException('Unauthorized address');
    }

    const isOwner = args.safe.owners.includes(signerAddress);
    if (!isOwner) {
      throw new BadGatewayException('Invalid signature');
    }
  }

  public async recoverSignerAddress(args: {
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<`0x${string}`> {
    // TODO: Throw is v is eth_sign and feature disabled
    try {
      return await recoverAddress({
        hash: args.messageHash,
        signature: args.signature,
      });
    } catch {
      throw new BadGatewayException('Could not recover signer address');
    }
  }
}
