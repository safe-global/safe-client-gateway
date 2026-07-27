// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

/**
 * Invalidates the cached policy events of a Safe.
 *
 * Policy events are not published to the events queue, so the policy endpoints
 * have no push invalidation of their own. Every policy change is however a Safe
 * transaction (`configureImmediately`, `requestConfiguration`,
 * `applyConfiguration`, `invalidateRoot`, `setGuard`), so the existing
 * transaction hooks are the invalidation signal.
 *
 * Deliberately kept free of the space/user dependencies of `PoliciesModule`, so
 * the hooks can invalidate policy caches without pulling them in.
 */
@Injectable()
export class PolicyCacheService {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  public async clearPolicies(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    const api = await this.transactionApiManager.getApi(args.chainId);

    await Promise.all([
      api.clearPolicyConfirmations(args.safeAddress),
      api.clearPolicyRootRequests(args.safeAddress),
    ]);
  }
}
