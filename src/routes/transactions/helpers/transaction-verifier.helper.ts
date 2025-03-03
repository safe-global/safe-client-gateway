import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { recoverAddress, isAddressEqual, recoverMessageAddress } from 'viem';
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
import {
  isApprovedHashV,
  isContractSignatureV,
  isEoaV,
  isEthSignV,
  normalizeEthSignSignature,
  splitConcatenatedSignatures,
  splitSignature,
} from '@/domain/common/utils/signatures';
import { TransactionValidityError } from '@/routes/transactions/errors/transaction-validity.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';

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

  public async verifyApiTransaction(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): Promise<void> {
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
      await this.verifyApiSignatures({ ...args, code });
    }
  }

  public async verifyProposal(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): Promise<void> {
    const code = HttpStatus.UNPROCESSABLE_ENTITY;

    if (this.isProposalHashVerificationEnabled) {
      this.verifyProposalSafeTxHash({ ...args, code });
    }
    if (this.isProposalSignatureVerificationEnabled) {
      await this.verifyProposalSignature({ ...args, code });
    }
  }

  public async verifyConfirmation(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
  }): Promise<void> {
    const code = HttpStatus.UNPROCESSABLE_ENTITY;

    if (this.isProposalHashVerificationEnabled) {
      this.verifyConfirmSafeTxHash({ ...args, code });
    }
    if (this.isProposalHashVerificationEnabled) {
      await this.verifyConfirmationSignature({ ...args, code });
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
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'MalformedHash',
      });
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'HashMismatch',
      });
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
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'MalformedHash',
      });
    }

    if (safeTxHash !== args.proposal.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        transaction,
        safeTxHash: args.proposal.safeTxHash,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'HashMismatch',
      });
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
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'MalformedHash',
      });
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'HashMismatch',
      });
    }
  }

  private async verifyApiSignatures(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    code: HttpStatus;
  }): Promise<void> {
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
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'DuplicateOwners',
      });
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
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'DuplicateSignatures',
      });
    }

    for (const confirmation of args.transaction.confirmations) {
      if (!confirmation.signature) {
        continue;
      }

      const address = await this.recoverAddress({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        signature: confirmation.signature,
      });

      const isBlocked = address && this.blocklist.includes(address);
      if (isBlocked) {
        throw new TransactionValidityError({
          code: args.code,
          type: 'BlockedAddress',
        });
      }

      if (
        address &&
        (!isAddressEqual(address, confirmation.owner) ||
          // We can be certain of no ownership changes as we only verify the queue
          !args.safe.owners.includes(address))
      ) {
        this.logInvalidSignature({
          ...args,
          safeTxHash: args.transaction.safeTxHash,
          signerAddress: confirmation.owner,
          signature: confirmation.signature,
        });
        throw new TransactionValidityError({
          code: args.code,
          type: 'InvalidSignature',
        });
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

    let signatures: Array<`0x${string}`>;
    try {
      // Clients may propose concatenated signatures so we need to split them
      signatures = splitConcatenatedSignatures(args.proposal.signature);
    } catch {
      this.logUnrecoverableAddress({
        ...args,
        safeTxHash: args.proposal.safeTxHash,
        signature: args.proposal.signature,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'UnrecoverableAddress',
      });
    }

    const recoveredAddresses: Array<`0x${string}`> = [];
    for (const signature of signatures) {
      const recoveredAddress = await this.recoverAddress({
        ...args,
        safeTxHash: args.proposal.safeTxHash,
        signature,
      });
      if (recoveredAddress) {
        recoveredAddresses.push(recoveredAddress);
      }
    }

    const hasBlockedAddresses = recoveredAddresses.some((address) => {
      return this.blocklist.includes(address);
    });
    if (hasBlockedAddresses) {
      throw new TransactionValidityError({
        code: args.code,
        type: 'BlockedAddress',
      });
    }

    const isSender = recoveredAddresses.includes(args.proposal.sender);
    if (!isSender) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.proposal.safeTxHash,
        signerAddress: args.proposal.sender,
        signature: args.proposal.signature,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'InvalidSignature',
      });
    }

    const areOwners = recoveredAddresses.every((address) =>
      args.safe.owners.includes(address),
    );
    if (areOwners) {
      return;
    }

    const delegates = await this.delegatesV2Repository.getDelegates({
      chainId: args.chainId,
      safeAddress: args.safe.address,
    });
    const isDelegate = delegates.results.some(({ delegate }) => {
      return delegate === args.proposal.sender;
    });
    if (isDelegate) {
      return;
    }

    this.logInvalidSignature({
      ...args,
      safeTxHash: args.proposal.safeTxHash,
      signerAddress: args.proposal.sender,
      signature: args.proposal.signature,
    });
    throw new TransactionValidityError({
      code: args.code,
      type: 'InvalidSignature',
    });
  }

  private async verifyConfirmationSignature(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
    code: HttpStatus;
  }): Promise<void> {
    const address = await this.recoverAddress({
      ...args,
      safeTxHash: args.transaction.safeTxHash,
      signature: args.signature,
    });

    if (address && !args.safe.owners.includes(address)) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        signerAddress: address,
        signature: args.signature,
      });
      throw new TransactionValidityError({
        code: args.code,
        type: 'InvalidSignature',
      });
    }
  }

  private async recoverAddress(args: {
    safe: Safe;
    chainId: string;
    safeTxHash: `0x${string}`;
    signature: `0x${string}`;
    code: HttpStatus;
  }): Promise<`0x${string}` | null> {
    const { v } = splitSignature(args.signature);

    if (isEthSignV(v) && !this.isEthSignEnabled) {
      throw new TransactionValidityError({
        code: args.code,
        type: 'EthSignDisabled',
      });
    }

    try {
      if (isEoaV(v)) {
        return await recoverAddress({
          hash: args.safeTxHash,
          signature: args.signature,
        });
      }
      if (isEthSignV(v)) {
        return await recoverMessageAddress({
          message: { raw: args.safeTxHash },
          signature: normalizeEthSignSignature(args.signature),
        });
      }
      // Approved hashes are valid
      // Contract signatures would need be verified on-chain
      if (isApprovedHashV(v) || isContractSignatureV(v)) {
        return null;
      }
    } catch {
      this.logUnrecoverableAddress(args);
    }

    throw new TransactionValidityError({
      code: args.code,
      type: 'UnrecoverableAddress',
    });
  }

  private logMalformedSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    transaction: BaseMultisigTransaction;
  }): void {
    this.loggingService.error({
      message: 'Could not calculate safeTxHash',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      transaction: getBaseMultisigTransaction(args.transaction),
      type: LogType.TransactionValidity,
    });
  }

  private logMismatchSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    transaction: BaseMultisigTransaction;
  }): void {
    this.loggingService.error({
      message: 'safeTxHash does not match',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      transaction: getBaseMultisigTransaction(args.transaction),
      type: LogType.TransactionValidity,
    });
  }

  private logDuplicates(args: {
    type: 'owners' | 'signatures';
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    confirmations: NonNullable<MultisigTransaction['confirmations']>;
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
    });
  }

  private logUnrecoverableAddress(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    this.loggingService.error({
      message: 'Could not recover address',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      signature: args.signature,
      type: LogType.TransactionValidity,
    });
  }

  private logInvalidSignature(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    signerAddress: `0x${string}`;
    signature: `0x${string}`;
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
    });
  }
}
