import {
  BadGatewayException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { recoverAddress, isAddressEqual, recoverMessageAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { ProposeTransactionDto } from '@/domain/transactions/entities/propose-transaction.dto.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import {
  isEoaV,
  isEthSignV,
  normalizeEthSignSignature,
  splitConcatenatedSignatures,
  splitSignature,
} from '@/domain/common/utils/signatures';
import { asError } from '@/logging/utils';

@Injectable()
export class TransactionVerifierHelper {
  private readonly isEthSignEnabled: boolean;
  private readonly isApiHashVerificationEnabled: boolean;
  private readonly isApiSignatureVerificationEnabled: boolean;
  private readonly isProposalHashVerificationEnabled: boolean;
  private readonly isProposalSignatureVerificationEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesV2Repository: IDelegatesV2Repository,
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

  private verifyApiSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      throw new BadGatewayException('Could not calculate safeTxHash');
    }

    if (safeTxHash !== args.transaction.safeTxHash) {
      throw new BadGatewayException('Invalid safeTxHash');
    }
  }

  private verifyProposalSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    proposal: ProposeTransactionDto;
  }): void {
    let safeTxHash: `0x${string}`;
    try {
      safeTxHash = getSafeTxHash({
        ...args,
        transaction: {
          ...args.proposal,
          nonce: Number(args.proposal.nonce),
          safeTxGas: Number(args.proposal.safeTxGas),
          baseGas: Number(args.proposal.baseGas),
        },
      });
    } catch {
      throw new UnprocessableEntityException('Could not calculate safeTxHash');
    }

    if (safeTxHash !== args.proposal.safeTxHash) {
      throw new UnprocessableEntityException('Invalid safeTxHash');
    }
  }

  private async verifyApiSignatures(args: {
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
      throw new BadGatewayException('Duplicate owners');
    }

    const uniqueSignatures = new Set(
      args.transaction.confirmations.map((c) => c.signature),
    );
    if (uniqueSignatures.size !== args.transaction.confirmations.length) {
      throw new BadGatewayException('Duplicate signatures');
    }

    for (const confirmation of args.transaction.confirmations) {
      if (!confirmation.signature) {
        continue;
      }

      let address: `0x${string}`;
      try {
        address = await this.recoverAddress({
          safeTxHash: args.transaction.safeTxHash,
          signature: confirmation.signature,
        });
      } catch (e) {
        throw new BadGatewayException(asError(e).message);
      }

      if (
        address &&
        (!isAddressEqual(address, confirmation.owner) ||
          // We can be certain of no ownership changes as we only verify the queue
          !args.safe.owners.includes(address))
      ) {
        throw new BadGatewayException('Invalid signature');
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

    // Clients may propose concatenated signatures so we need to split them
    const signatures: Array<`0x${string}`> = splitConcatenatedSignatures(
      args.proposal.signature,
    );

    const recoveredAddresses: Array<`0x${string}`> = [];
    for (const signature of signatures) {
      const recoveredAddress = await this.recoverAddress({
        safeTxHash: args.proposal.safeTxHash,
        signature,
      });
      recoveredAddresses.push(recoveredAddress);
    }

    const isSender = recoveredAddresses.includes(args.proposal.sender);
    if (!isSender) {
      throw new UnprocessableEntityException('Invalid signature');
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
        throw new UnprocessableEntityException('Invalid signature');
      }
    }
  }

  private async recoverAddress(args: {
    safeTxHash: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<`0x${string}`> {
    const { v } = splitSignature(args.signature);

    if (isEoaV(v)) {
      return await recoverAddress({
        hash: args.safeTxHash,
        signature: args.signature,
      });
    }
    if (isEthSignV(v)) {
      if (!this.isEthSignEnabled) {
        throw new Error('eth_sign is disabled');
      }
      return await recoverMessageAddress({
        message: { raw: args.safeTxHash },
        signature: normalizeEthSignSignature(args.signature),
      });
    }

    // Approved hashes are valid
    // Contract signatures would need be verified on-chain
    throw new Error('Cannot recover address');
  }
}
