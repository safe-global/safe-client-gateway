import { Safe } from './entities/safe.entity';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { Transaction } from './entities/transaction.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { SafeList } from './entities/safe-list.entity';
import { CreationTransaction } from './entities/creation-transaction.entity';
import { ProposeTransactionDto } from '../transactions/entities/propose-transaction.dto.entity';
import { AddConfirmationDto } from '../transactions/entities/add-confirmation.dto.entity';

export const ISafeRepository = Symbol('ISafeRepository');

export interface ISafeRepository {
  getSafe(args: { chainId: string; address: string }): Promise<Safe>;

  clearSafe(args: { chainId: string; address: string }): Promise<void>;

  getCollectibleTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearTransfers(args: { chainId: string; safeAddress: string }): Promise<void>;

  getIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transfer>>;

  clearIncomingTransfers(args: {
    chainId: string;
    safeAddress: string;
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
    safeAddress: string;
    to?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<ModuleTransaction>>;

  clearModuleTransactions(args: {
    chainId: string;
    safeAddress: string;
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
    safeAddress: string;
  }): Promise<CreationTransaction>;

  getTransactionHistory(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Transaction>>;

  getMultiSigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<MultisigTransaction>;

  clearAllExecutedTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  clearMultisigTransaction(args: {
    chainId: string;
    safeTransactionHash: string;
  }): Promise<void>;

  clearMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<void>;

  getMultisigTransactions(args: {
    chainId: string;
    safeAddress: string;
    executed?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<MultisigTransaction>>;

  getTransfer(args: { chainId: string; transferId: string }): Promise<Transfer>;

  getTransfers(args: {
    chainId: string;
    safeAddress: string;
    limit?: number;
  }): Promise<Page<Transfer>>;

  getSafesByOwner(args: {
    chainId: string;
    ownerAddress: string;
  }): Promise<SafeList>;

  getLastTransactionSortedByNonce(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<MultisigTransaction | null>;

  proposeTransaction(args: {
    chainId: string;
    safeAddress: string;
    proposeTransactionDto: ProposeTransactionDto;
  }): Promise<unknown>;
}
