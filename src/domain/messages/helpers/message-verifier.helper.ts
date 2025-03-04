import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Message } from '@/domain/messages/entities/message.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  recoverAddress,
  recoverMessageAddress,
  TypedDataDefinition,
} from 'viem';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { CreateMessageDto } from '@/routes/messages/entities/create-message.dto.entity';
import {
  splitSignature,
  isEoaV,
  isEthSignV,
  normalizeEthSignSignature,
} from '@/domain/common/utils/signatures';

enum ErrorMessage {
  MalformedHash = 'Could not calculate messageHash',
  HashMismatch = 'Invalid messageHash',
  UnrecoverableAddress = 'Could not recover address',
  InvalidSignature = 'Invalid signature',
  BlockedAddress = 'Unauthorized address',
}

@Injectable()
export class MessageVerifierHelper {
  // Methods are only used for incoming messages
  private static readonly StatusCode = HttpStatus.UNPROCESSABLE_ENTITY;

  private readonly isMessageVerificationEnabled: boolean;
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
    message: Message['message'];
    signature: `0x${string}`;
  }): Promise<void> {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    // We can't verify the messageHash as we have no comparison hash
    const calculatedHash = this.calculateMessageHash(args);

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
    message: Message['message'];
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<void> {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    this.verifyMessageHash({
      chainId: args.chainId,
      safe: args.safe,
      message: args.message,
      expectedHash: args.messageHash,
    });

    await this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: args.messageHash,
      signature: args.signature,
    });
  }

  private verifyMessageHash(args: {
    chainId: string;
    safe: Safe;
    expectedHash: `0x${string}`;
    message: string | Record<string, unknown>;
  }): void {
    const calculatedHash = this.calculateMessageHash(args);

    if (calculatedHash !== args.expectedHash) {
      this.logMismatchMessageHash({
        ...args,
        messageHash: args.expectedHash,
      });
      throw new HttpExceptionNoLog(
        ErrorMessage.HashMismatch,
        MessageVerifierHelper.StatusCode,
      );
    }
  }

  private calculateMessageHash(args: {
    chainId: string;
    safe: Safe;
    message: string | Record<string, unknown>;
  }): `0x${string}` {
    let calculatedHash: `0x${string}`;
    try {
      calculatedHash = getSafeMessageMessageHash({
        ...args,
        message: args.message as string | TypedDataDefinition,
      });
    } catch {
      this.logMalformedMessageHash(args);
      throw new HttpExceptionNoLog(
        ErrorMessage.MalformedHash,
        MessageVerifierHelper.StatusCode,
      );
    }
    return calculatedHash;
  }

  private async verifySignature(args: {
    safe: Safe;
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<void> {
    const signerAddress = await this.recoverSignerAddress(args);

    const isBlocked = this.blocklist.includes(signerAddress);
    if (isBlocked) {
      this.logBlockedAddress({
        ...args,
        blockedAddress: signerAddress,
      });
      throw new HttpExceptionNoLog(
        ErrorMessage.BlockedAddress,
        MessageVerifierHelper.StatusCode,
      );
    }

    const isOwner = args.safe.owners.includes(signerAddress);
    if (!isOwner) {
      this.logInvalidSignature({
        ...args,
        signerAddress,
      });
      throw new HttpExceptionNoLog(
        ErrorMessage.InvalidSignature,
        MessageVerifierHelper.StatusCode,
      );
    }
  }

  private async recoverSignerAddress(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<`0x${string}`> {
    // TODO: Throw is v is eth_sign and feature disabled
    const { v } = splitSignature(args.signature);

    try {
      if (isEoaV(v)) {
        return await recoverAddress({
          hash: args.messageHash,
          signature: args.signature,
        });
      }
      if (isEthSignV(v)) {
        return await recoverMessageAddress({
          message: { raw: args.messageHash },
          signature: normalizeEthSignSignature(args.signature),
        });
      }
    } catch {
      this.logUnrecoverableAddress(args);
    }

    throw new HttpExceptionNoLog(
      ErrorMessage.UnrecoverableAddress,
      MessageVerifierHelper.StatusCode,
    );
  }

  private logMalformedMessageHash(args: {
    chainId: string;
    safe: Safe;
    message: CreateMessageDto['message'];
  }): void {
    this.loggingService.error({
      message: 'Could not calculate messageHash',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeMessage: args.message,
      type: LogType.MessageValidity,
    });
  }

  private logMismatchMessageHash(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    message: CreateMessageDto['message'];
  }): void {
    this.loggingService.error({
      message: 'messageHash does not match',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      safeMessage: args.message,
      type: LogType.MessageValidity,
    });
  }

  private logUnrecoverableAddress(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    this.loggingService.error({
      message: 'Could not recover address',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      signature: args.signature,
      type: LogType.MessageValidity,
    });
  }

  private logBlockedAddress(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
    blockedAddress: `0x${string}`;
  }): void {
    this.loggingService.error({
      message: 'Unauthorized address',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      signature: args.signature,
      blockedAddress: args.blockedAddress,
      type: LogType.MessageValidity,
    });
  }

  private logInvalidSignature(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signerAddress: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    this.loggingService.error({
      message: 'Recovered address does not match signer',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      signerAddress: args.signerAddress,
      signature: args.signature,
      type: LogType.MessageValidity,
    });
  }
}
