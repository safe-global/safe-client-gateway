// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

/**
 * Safety cap on the number of pages read from a single Safe's transaction
 * queue to guard against an unbounded loop.
 */
export const MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN = 10;

@Injectable()
export class TransactionQueueHelper {
  public constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * The Safe and its whole transaction queue, capped at
   * {@link MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN} pages. `truncated` when pages
   * remain past the cap, which is logged.
   */
  public async read(safe: SafeRef): Promise<{
    safeInfo: Safe;
    transactions: Array<MultisigTransaction>;
    truncated: boolean;
  }> {
    const safeInfo = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });
    const limit = this.safeRepository.getTransactionQueueMaxPageSize();

    const transactions: Array<MultisigTransaction> = [];
    let next: string | null = null;

    for (let page = 0; page < MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN; page++) {
      const queue = await this.safeRepository.getTransactionQueue({
        chainId: safe.chainId,
        safe: safeInfo,
        limit,
        offset: page * limit,
      });
      transactions.push(...queue.results);
      next = queue.next;

      if (!next) {
        break;
      }
    }

    if (next) {
      this.loggingService.warn({
        message: 'Truncated a Safe transaction queue at the page cap',
        chainId: safe.chainId,
        safeAddress: safe.address,
        pages: MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN,
      });
    }

    return { safeInfo, transactions, truncated: next !== null };
  }
}
