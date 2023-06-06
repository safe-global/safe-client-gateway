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
  getSafe(chainId: string, address: string): Promise<Safe>;

  clearSafe(chainId: string, address: string): Promise<void>;

  getCollectibleTransfers(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>>;

  getIncomingTransfers(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transfer>>;

  addConfirmation(
    chainId: string,
    safeTxHash: string,
    addConfirmationDto: AddConfirmationDto,
  ): Promise<unknown>;

  getModuleTransaction(
    chainId: string,
    moduleTransactionId: string,
  ): Promise<ModuleTransaction>;

  getModuleTransactions(
    chainId: string,
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>>;

  /**
   * Returns the Safe Transaction Queue in ascending order.
   *
   * The ascending order is first considered for the nonce.
   * If multiple transactions have the same nonce, then they
   * will be sorted according to the submission date
   *
   * @param chainId - the chain id from where to retrieve the transactions from
   * @param safe - the target safe from where to get the transaction from
   * @param limit - the maximum number of transactions to be returned
   * @param offset - the starting point from which to start the pagination
   */
  getTransactionQueue(
    chainId: string,
    safe: Safe,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  /**
   * Returns the Safe Transaction Queue sorted by modified status.
   * (from most recently modified to last)
   *
   * @param chainId - the chain id from where to retrieve the transactions from
   * @param safe - the target safe from where to get the transaction from
   * @param limit - the maximum number of transactions to be returned
   * @param offset - the starting point from which to start the pagination
   */
  getTransactionQueueByModified(
    chainId: string,
    safe: Safe,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  getTransactionHistoryByExecutionDate(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>>;

  getCreationTransaction(
    chainId: string,
    safeAddress: string,
  ): Promise<CreationTransaction>;

  getTransactionHistory(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Transaction>>;

  getMultiSigTransaction(
    chainId: string,
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  clearMultisigTransaction(
    chainId: string,
    safeTransactionHash: string,
  ): Promise<void>;

  clearMultisigTransactions(
    chainId: string,
    safeAddress: string,
  ): Promise<void>;

  getMultisigTransactions(
    chainId: string,
    safeAddress: string,
    executed?: boolean,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  getTransfer(chainId: string, transferId: string): Promise<Transfer>;

  getSafesByOwner(chainId: string, ownerAddress: string): Promise<SafeList>;

  getLastTransactionSortedByNonce(
    chainId: string,
    safeAddress: string,
  ): Promise<MultisigTransaction | null>;

  proposeTransaction(
    chainId: string,
    safeAddress: string,
    proposeTransactionDto: ProposeTransactionDto,
  ): Promise<unknown>;
}
