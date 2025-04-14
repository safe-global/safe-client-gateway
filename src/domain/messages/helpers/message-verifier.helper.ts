import { IConfigurationService } from '@/config/configuration.service.interface';
import { LogSource } from '@/domain/common/entities/log-source.entity';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { getSafeMessageMessageHash } from '@/domain/common/utils/safe';
import { Message } from '@/domain/messages/entities/message.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { isAddressEqual } from 'viem';

enum ErrorMessage {
  MalformedHash = 'Could not calculate messageHash',
  HashMismatch = 'Invalid messageHash',
  InvalidSignature = 'Invalid signature',
  BlockedAddress = 'Unauthorized address',
}
@Injectable()
export class MessageVerifierHelper {
  // Methods are only used for incoming messages
  private static readonly StatusCode = HttpStatus.UNPROCESSABLE_ENTITY;

  private readonly isEthSignEnabled: boolean;
  private readonly isMessageVerificationEnabled: boolean;
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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
    message: Message['message'];
    signature: `0x${string}`;
  }): void {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    // We can't verify the messageHash as we have no comparison hash
    const calculatedHash = this.calculateMessageHash({
      ...args,
      source: LogSource.Proposal,
    });

    this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: calculatedHash,
      signature: args.signature,
      source: LogSource.Proposal,
    });
  }

  public verifyUpdate(args: {
    chainId: string;
    safe: Safe;
    message: Message['message'];
    messageHash: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    if (!this.isMessageVerificationEnabled) {
      return;
    }

    this.verifyMessageHash({
      chainId: args.chainId,
      safe: args.safe,
      message: args.message,
      expectedHash: args.messageHash,
      source: LogSource.Confirmation,
    });

    this.verifySignature({
      safe: args.safe,
      chainId: args.chainId,
      messageHash: args.messageHash,
      signature: args.signature,
      source: LogSource.Confirmation,
    });
  }

  private verifyMessageHash(args: {
    chainId: string;
    safe: Safe;
    expectedHash: `0x${string}`;
    message: Message['message'];
    source: LogSource;
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
    message: Message['message'];
    source: LogSource;
  }): `0x${string}` {
    let calculatedHash: `0x${string}`;
    try {
      calculatedHash = getSafeMessageMessageHash(args);
    } catch {
      this.logMalformedMessageHash(args);
      throw new HttpExceptionNoLog(
        ErrorMessage.MalformedHash,
        MessageVerifierHelper.StatusCode,
      );
    }
    return calculatedHash;
  }

  private verifySignature(args: {
    safe: Safe;
    chainId: string;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
    source: LogSource;
  }): void {
    const signature = new SafeSignature({
      hash: args.messageHash,
      signature: args.signature,
    });

    const isBlocked = this.blocklist.some((blockedAddress) => {
      return isAddressEqual(signature.owner, blockedAddress);
    });
    if (isBlocked) {
      this.logBlockedAddress({
        ...args,
        blockedAddress: signature.owner,
      });
      throw new HttpExceptionNoLog(
        ErrorMessage.BlockedAddress,
        MessageVerifierHelper.StatusCode,
      );
    }

    if (
      !this.isEthSignEnabled &&
      signature.signatureType === SignatureType.EthSign
    ) {
      throw new HttpExceptionNoLog(
        'eth_sign is disabled',
        MessageVerifierHelper.StatusCode,
      );
    }

    const isOwner = args.safe.owners.some((owner) => {
      return isAddressEqual(signature.owner, owner);
    });
    if (!isOwner) {
      this.logInvalidSignature({
        ...args,
        signerAddress: signature.owner,
      });
      throw new HttpExceptionNoLog(
        ErrorMessage.InvalidSignature,
        MessageVerifierHelper.StatusCode,
      );
    }
  }

  private logMalformedMessageHash(args: {
    chainId: string;
    safe: Safe;
    message: Message['message'];
    source: LogSource;
  }): void {
    // We do not include the type as it is not a validity error
    this.loggingService.error({
      message: 'Could not calculate messageHash',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeMessage: args.message,
      source: args.source,
    });
  }

  private logMismatchMessageHash(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    message: Message['message'];
    source: LogSource;
  }): void {
    this.loggingService.error({
      message: 'messageHash does not match',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      safeMessage: args.message,
      type: LogType.MessageValidity,
      source: args.source,
    });
  }

  private logBlockedAddress(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signature: `0x${string}`;
    blockedAddress: `0x${string}`;
    source: LogSource;
  }): void {
    this.loggingService.error({
      event: 'Unauthorized address',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      signature: args.signature,
      blockedAddress: args.blockedAddress,
      type: LogType.MessageValidity,
      source: args.source,
    });
  }

  private logInvalidSignature(args: {
    chainId: string;
    safe: Safe;
    messageHash: `0x${string}`;
    signerAddress: `0x${string}`;
    signature: `0x${string}`;
    source: LogSource;
  }): void {
    this.loggingService.error({
      event: 'Recovered address does not match signer',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      messageHash: args.messageHash,
      signerAddress: args.signerAddress,
      signature: args.signature,
      type: LogType.MessageValidity,
      source: args.source,
    });
  }
}
