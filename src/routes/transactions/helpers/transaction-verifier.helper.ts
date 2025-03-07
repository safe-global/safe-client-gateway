import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  BaseMultisigTransaction,
  getBaseMultisigTransaction,
  getSafeTxHash,
} from '@/domain/common/utils/safe';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { SafeSignature } from '@/domain/common/entities/safe-signature';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { LogSource } from '@/domain/common/entities/log-source.entity';
import { isAddressEqual } from 'viem';

enum ErrorMessage {
  MalformedHash = 'Could not calculate safeTxHash',
  HashMismatch = 'Invalid safeTxHash',
  DuplicateOwners = 'Duplicate owners in confirmations',
  DuplicateSignatures = 'Duplicate signatures in confirmations',
  InvalidSignature = 'Invalid signature',
  BlockedAddress = 'Unauthorized address',
  EthSignDisabled = 'eth_sign is disabled',
  InvalidNonce = 'Invalid nonce',
}

@Injectable()
export class TransactionVerifierHelper {
  private readonly isEthSignEnabled: boolean;
  private readonly isApiHashVerificationEnabled: boolean;
  private readonly isApiSignatureVerificationEnabled: boolean;
  private readonly isProposalHashVerificationEnabled: boolean;
  private readonly isProposalSignatureVerificationEnabled: boolean;
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesV2Repository: IDelegatesV2Repository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isEthSignEnabled =
      this.configurationService.getOrThrow('features.ethSign');
    this.isApiHashVerificationEnabled = this.configurationService.getOrThrow(
      'features.hashVerification.api',
    );
    this.isApiSignatureVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.signatureVerification.api',
      );
    this.isProposalHashVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.hashVerification.proposal',
      );
    this.isProposalSignatureVerificationEnabled =
      this.configurationService.getOrThrow(
        'features.signatureVerification.proposal',
      );
    this.blocklist = this.configurationService.getOrThrow(
      'blockchain.blocklist',
    );
  }

  public verifyApiTransaction(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): void {
    if (
      args.transaction.isExecuted ||
      args.transaction.nonce < args.safe.nonce
    ) {
      return;
    }
    const code = HttpStatus.BAD_GATEWAY;

    if (this.isApiHashVerificationEnabled) {
      this.verifyApiSafeTxHash({ ...args, code });
    }
    if (this.isApiSignatureVerificationEnabled) {
      this.verifyApiSignatures({ ...args, code });
    }
  }

  public async verifyProposal(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): Promise<void> {
    const code = HttpStatus.UNPROCESSABLE_ENTITY;

    if (Number(args.proposal.nonce) < args.safe.nonce) {
      throw new HttpExceptionNoLog(ErrorMessage.InvalidNonce, code);
    }
    if (this.isProposalHashVerificationEnabled) {
      this.verifyProposalSafeTxHash({ ...args, code });
    }
    if (this.isProposalSignatureVerificationEnabled) {
      await this.verifyProposalSignature({ ...args, code });
    }
  }

  public verifyConfirmation(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
  }): void {
    const code = HttpStatus.UNPROCESSABLE_ENTITY;

    if (
      args.transaction.isExecuted ||
      args.transaction.nonce < args.safe.nonce
    ) {
      throw new HttpExceptionNoLog(ErrorMessage.InvalidNonce, code);
    }

    this.verifyApiTransaction(args);

    if (this.isProposalHashVerificationEnabled) {
      this.verifyConfirmSafeTxHash({ ...args, code });
    }
    if (this.isProposalHashVerificationEnabled) {
      this.verifyConfirmationSignature({ ...args, code });
    }
  }

  private verifyApiSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    code: HttpStatus;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      this.logMalformedSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        source: LogSource.Api,
      });
      throw new HttpExceptionNoLog(ErrorMessage.MalformedHash, args.code);
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        source: LogSource.Api,
      });
      throw new HttpExceptionNoLog(ErrorMessage.HashMismatch, args.code);
    }
  }

  private verifyProposalSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
    code: HttpStatus;
  }): void {
    const transaction: BaseMultisigTransaction = {
      ...args.proposal,
      nonce: Number(args.proposal.nonce),
      safeTxGas: Number(args.proposal.safeTxGas),
      baseGas: Number(args.proposal.baseGas),
    };

    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash({
        ...args,
        transaction,
      });
    } catch {
      this.logMalformedSafeTxHash({
        ...args,
        transaction,
        safeTxHash: args.proposal.safeTxHash,
        source: LogSource.Proposal,
      });
      throw new HttpExceptionNoLog(ErrorMessage.MalformedHash, args.code);
    }

    if (safeTxHash !== args.proposal.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        transaction,
        safeTxHash: args.proposal.safeTxHash,
        source: LogSource.Proposal,
      });
      throw new HttpExceptionNoLog(ErrorMessage.HashMismatch, args.code);
    }
  }

  private verifyConfirmSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    code: HttpStatus;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      this.logMalformedSafeTxHash({
        ...args,
        transaction: args.transaction,
        safeTxHash: args.transaction.safeTxHash,
        source: LogSource.Confirmation,
      });
      throw new HttpExceptionNoLog(ErrorMessage.MalformedHash, args.code);
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        source: LogSource.Confirmation,
      });
      throw new HttpExceptionNoLog(ErrorMessage.HashMismatch, args.code);
    }
  }

  private verifyApiSignatures(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    code: HttpStatus;
  }): void {
    if (
      !args.transaction.confirmations ||
      args.transaction.confirmations.length === 0
    ) {
      return;
    }

    const uniqueOwners = new Set(
      args.transaction.confirmations.map((c) => c.owner),
    );
    if (uniqueOwners.size !== args.transaction.confirmations.length) {
      this.logDuplicates({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        confirmations: args.transaction.confirmations,
        type: 'owners',
        source: LogSource.Api,
      });
      throw new HttpExceptionNoLog(ErrorMessage.DuplicateOwners, args.code);
    }

    const uniqueSignatures = new Set(
      args.transaction.confirmations.map((c) => c.signature),
    );
    if (uniqueSignatures.size !== args.transaction.confirmations.length) {
      this.logDuplicates({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        confirmations: args.transaction.confirmations,
        type: 'signatures',
        source: LogSource.Api,
      });
      throw new HttpExceptionNoLog(ErrorMessage.DuplicateSignatures, args.code);
    }

    for (const confirmation of args.transaction.confirmations) {
      if (!confirmation.signature) {
        continue;
      }

      const signature = new SafeSignature({
        hash: args.transaction.safeTxHash,
        signature: confirmation.signature,
      });

      const isBlocked = this.blocklist.some((blockedAddress) => {
        return isAddressEqual(blockedAddress, signature.owner);
      });
      if (isBlocked) {
        this.logBlockedAddress({
          ...args,
          safeTxHash: args.transaction.safeTxHash,
          blockedAddress: signature.owner,
          source: LogSource.Api,
        });
        throw new HttpExceptionNoLog(ErrorMessage.BlockedAddress, args.code);
      }

      const isOwner = args.safe.owners.some((owner) => {
        return isAddressEqual(owner, signature.owner);
      });
      if (
        // We can be certain of no ownership changes as we only verify the queue
        !isOwner ||
        !isAddressEqual(signature.owner, confirmation.owner)
      ) {
        this.logInvalidSignature({
          ...args,
          safeTxHash: args.transaction.safeTxHash,
          signerAddress: confirmation.owner,
          signature: confirmation.signature,
          source: LogSource.Api,
        });
        throw new HttpExceptionNoLog(ErrorMessage.InvalidSignature, args.code);
      }
    }
  }

  private async verifyProposalSignature(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
    code: HttpStatus;
  }): Promise<void> {
    if (!args.proposal.signature) {
      return;
    }

    const signatures: Array<SafeSignature> = [];

    // Clients may propose concatenated signatures so we need to split them
    for (let i = 2; i < args.proposal.signature.length; i += 130) {
      const signature = new SafeSignature({
        hash: args.proposal.safeTxHash,
        signature: `0x${args.proposal.signature.slice(i, i + 130)}`,
      });

      const isBlocked = this.blocklist.some((blockedAddress) => {
        return isAddressEqual(blockedAddress, signature.owner);
      });
      if (isBlocked) {
        this.logBlockedAddress({
          ...args,
          safeTxHash: args.proposal.safeTxHash,
          blockedAddress: signature.owner,
          source: LogSource.Proposal,
        });
        throw new HttpExceptionNoLog(ErrorMessage.BlockedAddress, args.code);
      }

      if (
        !this.isEthSignEnabled &&
        signature.signatureType === SignatureType.EthSign
      ) {
        throw new HttpExceptionNoLog(ErrorMessage.EthSignDisabled, args.code);
      }

      signatures.push(signature);
    }

    const isSender = signatures.some((signature) => {
      return isAddressEqual(signature.owner, args.proposal.sender);
    });
    if (!isSender) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.proposal.safeTxHash,
        signerAddress: args.proposal.sender,
        signature: args.proposal.signature,
        source: LogSource.Proposal,
      });
      throw new HttpExceptionNoLog(ErrorMessage.InvalidSignature, args.code);
    }

    const areOwners = signatures.every((signature) => {
      return args.safe.owners.some((owner) => {
        return isAddressEqual(owner, signature.owner);
      });
    });
    if (areOwners) {
      return;
    }

    const delegates = await this.delegatesV2Repository.getDelegates({
      chainId: args.chainId,
      safeAddress: args.safe.address,
    });
    const isDelegate = delegates.results.some(({ delegate }) => {
      return isAddressEqual(delegate, args.proposal.sender);
    });
    if (isDelegate) {
      return;
    }

    this.logInvalidSignature({
      ...args,
      safeTxHash: args.proposal.safeTxHash,
      signerAddress: args.proposal.sender,
      signature: args.proposal.signature,
      source: LogSource.Proposal,
    });
    throw new HttpExceptionNoLog(ErrorMessage.InvalidSignature, args.code);
  }

  private verifyConfirmationSignature(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
    code: HttpStatus;
  }): void {
    const signature = new SafeSignature({
      signature: args.signature,
      hash: args.transaction.safeTxHash,
    });

    const isBlocked = this.blocklist.some((blockedAddress) => {
      return isAddressEqual(blockedAddress, signature.owner);
    });
    if (isBlocked) {
      this.logBlockedAddress({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        blockedAddress: signature.owner,
        source: LogSource.Confirmation,
      });
      throw new HttpExceptionNoLog(ErrorMessage.BlockedAddress, args.code);
    }

    if (
      !this.isEthSignEnabled &&
      signature.signatureType === SignatureType.EthSign
    ) {
      throw new HttpExceptionNoLog(ErrorMessage.EthSignDisabled, args.code);
    }

    const isOwner = args.safe.owners.some((owner) => {
      return isAddressEqual(owner, signature.owner);
    });
    if (!isOwner) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        signerAddress: signature.owner,
        signature: args.signature,
        source: LogSource.Confirmation,
      });
      throw new HttpExceptionNoLog(ErrorMessage.InvalidSignature, args.code);
    }
  }

  private logMalformedSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    transaction: BaseMultisigTransaction;
    source: LogSource;
  }): void {
    this.loggingService.error({
      message: 'Could not calculate safeTxHash',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      transaction: getBaseMultisigTransaction(args.transaction),
      type: LogType.TransactionValidity,
      source: args.source,
    });
  }

  private logMismatchSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    transaction: BaseMultisigTransaction;
    source: LogSource;
  }): void {
    this.loggingService.error({
      message: 'safeTxHash does not match',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      transaction: getBaseMultisigTransaction(args.transaction),
      type: LogType.TransactionValidity,
      source: args.source,
    });
  }

  private logDuplicates(args: {
    type: 'owners' | 'signatures';
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    confirmations: NonNullable<MultisigTransaction['confirmations']>;
    source: LogSource;
  }): void {
    const message =
      args.type === 'owners'
        ? 'Duplicate owners in confirmations'
        : 'Duplicate signatures in confirmations';

    this.loggingService.error({
      message,
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      confirmations: args.confirmations,
      type: LogType.TransactionValidity,
      source: args.source,
    });
  }

  private logBlockedAddress(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    blockedAddress: `0x${string}`;
    source: LogSource;
  }): void {
    this.loggingService.error({
      message: 'Unauthorized address',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      blockedAddress: args.blockedAddress,
      type: LogType.TransactionValidity,
      source: args.source,
    });
  }

  private logInvalidSignature(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    signerAddress: `0x${string}`;
    signature: `0x${string}`;
    source: LogSource;
  }): void {
    this.loggingService.error({
      message: 'Recovered address does not match signer',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      signerAddress: args.signerAddress,
      signature: args.signature,
      type: LogType.TransactionValidity,
      source: args.source,
    });
  }
}
