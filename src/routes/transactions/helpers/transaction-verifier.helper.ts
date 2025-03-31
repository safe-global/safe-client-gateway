import { Inject } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { IDelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { isAddressEqual } from 'viem';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { SafeHashHelper } from '@/domain/common/helpers/safe-hash.helper';
import { SafeSignatureHelper } from '@/domain/common/helpers/safe-signature.helper';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { Message } from '@/domain/messages/entities/message.entity';

export class TransactionVerifierHelper {
  private readonly blocklist: Array<`0x${string}`>;

  constructor(
    private readonly safeHashHelper: SafeHashHelper,
    private readonly safeSignatureHelper: SafeSignatureHelper,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IContractsRepository)
    private readonly contractsRepository: IContractsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IDelegatesV2Repository)
    private readonly delegatesRepository: IDelegatesV2Repository,
  ) {
    this.blocklist = this.configurationService.getOrThrow(
      'blockchain.blocklist',
    );
  }

  // TODO: Rename accordingly
  public async verifyTransaction(args: {
    chainId: string;
    address: `0x${string}`;
    transaction: {
      to: `0x${string}`;
      value: string;
      data: `0x${string}` | null;
      operation: Operation;
      nonce: number;
      safeTxGas: number | null;
      baseGas: number | null;
      gasPrice: string | null;
      gasToken: `0x${string}` | null;
      refundReceiver: `0x${string}` | null;
      safeTxHash: `0x${string}`;
    };
    signatures: Array<`0x${string}`>;
  }): Promise<void> {
    const safe = await this.safeRepository.getSafe(args);

    if (safe.nonce > args.transaction.nonce) {
      return;
    }
    const expectedSafeTxHash = this.safeHashHelper.generateSafeTxHash({
      ...args,
      safe,
    });

    if (args.transaction.safeTxHash !== expectedSafeTxHash) {
      // TODO: Add logging and appropriate error
      throw new Error('Hash mismatch');
    }

    if (args.transaction.operation === Operation.DELEGATE) {
      const isTrustedForDelegateCall = await this.contractsRepository
        .isTrustedForDelegateCall({
          chainId: args.chainId,
          contractAddress: args.transaction.to,
        })
        .catch(() => false);

      if (!isTrustedForDelegateCall) {
        // TODO: Add logging and appropriate error
        throw new Error('Delegate call is disabled');
      }
    }

    if (args.signatures.length === 0) {
      return;
    }

    // TODO: Use no cache
    // TODO: Handle existing signatures
    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId: args.chainId,
      safeTransactionHash: expectedSafeTxHash,
    });

    for (const signature of args.signatures) {
      await this.verifySignature({
        ...args,
        safe,
        signature,
        hash: expectedSafeTxHash,
      });
    }
  }

  public async verifyMessage(args: {
    chainId: string;
    address: `0x${string}`;
    message: Message['message'];
    messageHash?: `0x${string}`;
    signature: `0x${string}` | null;
  }): Promise<void> {
    const safe = await this.safeRepository.getSafe(args);
    const expectedMessageHash = this.safeHashHelper.generateSafeMessageHash({
      ...args,
      safe,
    });

    if (args.messageHash && args.messageHash !== expectedMessageHash) {
      // TODO: Add logging and appropriate error
      throw new Error('Hash mismatch');
    }

    if (args.signature) {
      await this.verifySignature({
        ...args,
        signature: args.signature,
        safe,
        hash: expectedMessageHash,
      });
    }
  }

  private async verifySignature(args: {
    chainId: string;
    safe: Safe;
    signature: `0x${string}`;
    hash: `0x${string}`;
  }): Promise<void> {
    const { signatureType } = this.safeSignatureHelper.parseSignature(
      args.signature,
    );

    if (signatureType === SignatureType.EthSign) {
      // TODO: Add logging and appropriate error
      throw new Error('eth_sign disabled');
    }

    let signer: `0x${string}`;
    try {
      signer = await this.safeSignatureHelper.recoverAddress(args);
    } catch {
      // TODO: Add logging and appropriate error
      throw new Error('Could not recover signer');
    }

    const isBlocked = this.blocklist.includes(signer);
    if (isBlocked) {
      // TODO: Add logging and appropriate error
      throw new Error('Blocked');
    }

    const isOwner = args.safe.owners.some((owner) => {
      return isAddressEqual(owner, signer);
    });
    if (isOwner) {
      return;
    }

    // TODO: Only for transaction
    const delegates = await this.delegatesRepository.getDelegates({
      chainId: args.chainId,
      safeAddress: args.safe.address,
    });
    const isDelegate = delegates.results.some((delegate) => {
      return isAddressEqual(delegate.delegate, signer);
    });
    if (!isDelegate) {
      // TODO: Add logging and appropriate error
      throw new Error('Invalid signature');
    }
  }
}
