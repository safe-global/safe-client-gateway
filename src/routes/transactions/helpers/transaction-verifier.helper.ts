import {
  BadGatewayException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
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
  Signature,
  splitConcatenatedSignatures,
  splitSignature,
} from '@/domain/common/utils/signatures';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

enum ErrorMessage {
  MalformedHash = 'Could not calculate safeTxHash',
  HashMismatch = 'Invalid safeTxHash',
  DuplicateOwners = 'Duplicate owners in confirmations',
  DuplicateSignatures = 'Duplicate signatures in confirmations',
  UnrecoverableAddress = 'Could not recover address',
  InvalidSignature = 'Invalid signature',
}

@Injectable()
export class TransactionVerifierHelper {
  private static readonly TRANSACTION_TYPE = 'multisig_transaction_validity';

  private readonly isApiHashVerificationEnabled: boolean;
  private readonly isApiSignatureVerificationEnabled: boolean;
  private readonly isProposalHashVerificationEnabled: boolean;
  private readonly isProposalSignatureVerificationEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesV2Repository: IDelegatesV2Repository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
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
  }

  public async verifyApiTransaction(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): Promise<void> {
    if (args.transaction.isExecuted) {
      return;
    }
    if (this.isApiHashVerificationEnabled) {
      this.verifyApiSafeTxHash(args);
    }
    if (this.isApiSignatureVerificationEnabled) {
      await this.verifyApiSignatures(args);
    }
  }

  public async verifyProposal(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): Promise<void> {
    if (this.isProposalHashVerificationEnabled) {
      this.verifyProposalSafeTxHash(args);
    }
    if (this.isProposalSignatureVerificationEnabled) {
      await this.verifyProposalSignature(args);
    }
  }

  public async verifyConfirmation(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
  }): Promise<void> {
    if (this.isProposalHashVerificationEnabled) {
      this.verifyConfirmSafeTxHash(args);
    }
    if (this.isProposalHashVerificationEnabled) {
      await this.verifyConfirmationSignature(args);
    }
  }

  private verifyApiSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      this.logMalformedSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
      });
      throw new BadGatewayException('Could not calculate safeTxHash');
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
      });
      throw new BadGatewayException('Invalid safeTxHash');
    }
  }

  private verifyProposalSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
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
      throw new UnprocessableEntityException(ErrorMessage.MalformedHash);
    }

    if (safeTxHash !== args.proposal.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        transaction,
        safeTxHash: args.proposal.safeTxHash,
      });
      throw new UnprocessableEntityException(ErrorMessage.HashMismatch);
    }
  }

  private verifyConfirmSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
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
      throw new UnprocessableEntityException(ErrorMessage.MalformedHash);
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      this.logMismatchSafeTxHash({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
      });
      throw new BadGatewayException(ErrorMessage.HashMismatch);
    }
  }

  private async verifyApiSignatures(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
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
      throw new BadGatewayException(ErrorMessage.DuplicateOwners);
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
      throw new BadGatewayException(ErrorMessage.DuplicateSignatures);
    }

    for (const confirmation of args.transaction.confirmations) {
      if (!confirmation.signature) {
        continue;
      }

      let address: `0x${string}` | null;
      try {
        address = await this.recoverAddress({
          safeTxHash: args.transaction.safeTxHash,
          signature: confirmation.signature,
        });
      } catch {
        this.logUnrecoverableAddress({
          ...args,
          safeTxHash: args.transaction.safeTxHash,
          signature: confirmation.signature,
        });
        throw new BadGatewayException(ErrorMessage.UnrecoverableAddress);
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
          signer: confirmation.owner,
          signature: confirmation.signature,
        });
        throw new BadGatewayException(ErrorMessage.InvalidSignature);
      }
    }
  }

  private async verifyProposalSignature(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
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
      throw new UnprocessableEntityException(ErrorMessage.UnrecoverableAddress);
    }

    const recoveredAddresses: Array<`0x${string}`> = [];
    for (const signature of signatures) {
      try {
        const recoveredAddress = await this.recoverAddress({
          safeTxHash: args.proposal.safeTxHash,
          signature,
        });
        if (recoveredAddress) {
          recoveredAddresses.push(recoveredAddress);
        }
      } catch {
        this.logUnrecoverableAddress({
          ...args,
          safeTxHash: args.proposal.safeTxHash,
          signature,
        });
        throw new UnprocessableEntityException(
          ErrorMessage.UnrecoverableAddress,
        );
      }
    }

    const isSender = recoveredAddresses.includes(args.proposal.sender);
    if (!isSender) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.proposal.safeTxHash,
        signer: args.proposal.sender,
        signature: args.proposal.signature,
      });
      throw new UnprocessableEntityException(ErrorMessage.InvalidSignature);
    }

    const isOwner = args.safe.owners.includes(args.proposal.sender);
    if (!isOwner) {
      const delegates = await this.delegatesV2Repository.getDelegates({
        chainId: args.chainId,
        safeAddress: args.safe.address,
      });
      const isDelegate = delegates.results.some(({ delegate }) => {
        return delegate === args.proposal.sender;
      });
      if (!isDelegate) {
        this.logInvalidSignature({
          ...args,
          safeTxHash: args.proposal.safeTxHash,
          signer: args.proposal.sender,
          signature: args.proposal.signature,
        });
        throw new UnprocessableEntityException(ErrorMessage.InvalidSignature);
      }
    }
  }

  private async verifyConfirmationSignature(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
    signature: `0x${string}`;
  }): Promise<void> {
    let address: `0x${string}` | null;
    try {
      address = await this.recoverAddress({
        safeTxHash: args.transaction.safeTxHash,
        signature: args.signature,
      });
    } catch {
      this.logUnrecoverableAddress({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        signature: args.signature,
      });
      throw new UnprocessableEntityException(ErrorMessage.UnrecoverableAddress);
    }

    if (address && !args.safe.owners.includes(address)) {
      this.logInvalidSignature({
        ...args,
        safeTxHash: args.transaction.safeTxHash,
        signer: address,
        signature: args.signature,
      });
      throw new UnprocessableEntityException(ErrorMessage.InvalidSignature);
    }
  }

  private async recoverAddress(args: {
    safeTxHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<`0x${string}` | null> {
    const { v } = splitSignature(args.signature);

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
    if (this.isUnrecoverableV(v)) {
      return null;
    }
    throw new Error('Unknown signature type');
  }

  // We have no blockchain capabilities in order to recover these
  private isUnrecoverableV(v: Signature['v']): boolean {
    return isApprovedHashV(v) || isContractSignatureV(v);
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
      type: TransactionVerifierHelper.TRANSACTION_TYPE,
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
      type: TransactionVerifierHelper.TRANSACTION_TYPE,
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
      type: TransactionVerifierHelper.TRANSACTION_TYPE,
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
      type: TransactionVerifierHelper.TRANSACTION_TYPE,
    });
  }

  private logInvalidSignature(args: {
    chainId: string;
    safe: Safe;
    safeTxHash: `0x${string}`;
    signer: `0x${string}`;
    signature: `0x${string}`;
  }): void {
    this.loggingService.error({
      message: 'Recovered address does not match signer',
      chainId: args.chainId,
      safeAddress: args.safe.address,
      safeVersion: args.safe.version,
      safeTxHash: args.safeTxHash,
      signer: args.signer,
      signature: args.signature,
      type: TransactionVerifierHelper.TRANSACTION_TYPE,
    });
  }
}
