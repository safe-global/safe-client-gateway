import { Page } from '@/domain/entities/page.entity';
import { CreationTransaction } from '@/modules/safe/domain/entities/creation-transaction.entity';
import { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { SafeList } from '@/modules/safe/domain/entities/safe-list.entity';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { Transaction } from '@/modules/safe/domain/entities/transaction.entity';
import { Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import { AddConfirmationDto } from '@/modules/transactions/domain/entities/add-confirmation.dto.entity';
import { ProposeTransactionDto } from '@/modules/transactions/domain/entities/propose-transaction.dto.entity';
import { SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import { SafesByChainIdV3 } from '@/modules/safe/domain/entities/safes-by-chain-id-v3.entity';
import { Module } from '@nestjs/common';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ChainsModule } from '@/modules/chains/chains.module';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import type { Address } from 'viem';

export const ISafeRepository = Symbol('ISafeRepository');

export interface ISafeRepository {
  getSafe(args: { chainId: string; address: Address }): Promise<Safe>;

  clearSafe(args: { chainId: string; address: Address }): Promise<void>;

  isSafe(args: { chainId: string; address: Address }): Promise<boolean>;

  clearIsSafe(args: { chainId: string; address: Address }): Promise<void>;

  isOwner(args: {
    chainId: string;
    safeAddress: Address;
    address: Address;
  }): Promise<boolean>;

  getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearTransfers(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getIncomingTransfers(args: {
    chainId: string;
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: Address;
    value?: string;
    tokenAddress?: Address;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  addConfirmation(args: {
    chainId: string;
    safeTxHash: string;
    addConfirmationDto: AddConfirmationDto;
  }): Promise<unknown>;

  getModuleTransaction(args: {
    chainId: string;
    moduleTransactionId: string;
  }): Promise<ModuleTransaction>;

  getModuleTransactions(args: {
    chainId: string;
    safeAddress: Address;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  /**
   * Returns the Safe Transaction Queue in ascending order.
   *
   * The ascending order is first considered for the nonce.
   * If multiple transactions have the same nonce, then they
   * will be sorted according to the submission date
   */
  getTransactionQueue(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  /**
   * Returns the Safe Transaction Queue sorted by modified status.
   * (from most recently modified to last)
   */
  getTransactionQueueByModified(args: {
    chainId: string;
    safe: Safe;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  getCreationTransaction(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<CreationTransaction>;

  getTransactionHistory(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction>;

  clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void>;

  clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void>;

  getMultisigTransactions(args: {
    chainId: string;
    safeAddress: Address;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  deleteTransaction(args: {
    chainId: string;
    safeTxHash: string;
    signature: string;
  }): Promise<void>;

  getTransfer(args: { chainId: string; transferId: string }): Promise<Transfer>;

  getTransfers(args: {
    chainId: string;
    safeAddress: Address;
    limit?: number;
  }): Promise<Page<Transfer>>;

  getSafesByOwner(args: {
    chainId: string;
    ownerAddress: Address;
  }): Promise<SafeList>;

  getAllSafesByOwner(args: { ownerAddress: Address }): Promise<SafesByChainId>;

  getAllSafesByOwnerV3(args: {
    ownerAddress: Address;
  }): Promise<SafesByChainIdV3>;

  getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<MultisigTransaction | null>;

  proposeTransaction(args: {
    chainId: string;
    safeAddress: Address;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown>;

  /**
   * Returns the nonce information for a Safe which includes its current nonce
   * and the recommended nonce for transaction execution.
   *
   * The recommended nonce is executed by getting the maximum between the
   * current Safe nonce and the last transaction nonce plus 1.
   * If there is no last transaction, the Safe nonce is returned.
   *
   * @returns the nonce state of the safe
   */
  getNonces(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<{ currentNonce: number; recommendedNonce: number }>;

  getSafesByModule(args: {
    chainId: string;
    moduleAddress: Address;
  }): Promise<SafeList>;
}

@Module({
  imports: [
    ChainsModule,
    TransactionApiManagerModule,
    DelegatesV2RepositoryModule,
    ContractsModule,
  ],
  providers: [
    {
      provide: ISafeRepository,
      useClass: SafeRepository,
    },
    TransactionVerifierHelper,
  ],
  exports: [ISafeRepository],
})
export class SafeRepositoryModule {}
