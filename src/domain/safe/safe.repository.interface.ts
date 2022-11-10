import { Safe } from './entities/safe.entity';
import { Page } from '../entities/page.entity';
import { Transfer } from './entities/transfer.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { TransactionType } from './entities/transaction-type.entity';
import { ModuleTransaction } from './entities/module-transaction.entity';
import { SafeList } from './entities/safe-list.entity';

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

  getModuleTransactions(
    chainId: string,
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<ModuleTransaction>>;

  getQueuedTransactions(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<MultisigTransaction>>;

  getTransactionHistory(
    chainId: string,
    safeAddress: string,
  ): Promise<Page<TransactionType>>;

  getMultiSigTransaction(
    chainId: string,
    safeTransactionHash: string,
  ): Promise<MultisigTransaction>;

  getSafesByOwner(chainId: string, ownerAddress: string): Promise<SafeList>;
}
