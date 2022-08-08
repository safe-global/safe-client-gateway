import { ISafeTransactionService } from './safe-transaction.service';

export interface ISafeTransactionManager {
  getTransactionService(chainId: string): Promise<ISafeTransactionService>;
}
