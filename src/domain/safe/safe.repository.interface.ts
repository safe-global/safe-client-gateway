import { Safe } from './entities/safe.entity';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { Transaction } from './entities/transaction.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { SafeList } from './entities/safe-list.entity';
import { CreationTransaction } from './entities/creation-transaction.entity';
import { ProposeTransactionDto } from '../transactions/entities/propose-transaction.dto.entity';
import { CreateConfirmationDto } from '../transactions/entities/create-confirmation.dto.entity';

export const ISafeRepository = Symbol('ISafeRepository');

export interface ISafeRepository {
  getSafe(chainId: string, address: string): Promise<Safe>;

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

  createConfirmation(
    chainId: string,
    safeTxHash: string,
    createConfirmationDto: CreateConfirmationDto,
  ): Promise<unknown>;

  getModuleTransactions(
    chainId: string,
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>>;

  getTransactionQueueByModified(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  getTransactionQueueByNonce(
    chainId: string,
    safeAddress: string,
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
