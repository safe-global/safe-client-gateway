// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { Page } from '@/domain/entities/page.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { PolicyConfirmationPageSchema } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import {
  type PolicyRootRequest,
  PolicyRootRequestPageSchema,
} from '@/modules/policies/domain/entities/policy-root-request.entity';
import type { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import { policyGroups } from '@/modules/policies/domain/utils/policy-state.utils';

@Injectable()
export class PoliciesRepository implements IPoliciesRepository {
  /**
   * Page size used against the Transaction Service.
   */
  private static readonly PAGE_SIZE = 100;

  /**
   * Upper bound on pages fetched per Safe, i.e. `PAGE_SIZE * MAX_PAGES` events.
   *
   * The Transaction Service exposes the raw event stream without a
   * `current`/`active` filter, so the whole history of a Safe has to be reduced
   * client-side. The cap keeps a pathological history from stalling a request;
   * reaching it is logged rather than silently truncated.
   *
   * TODO(WA-2914): remove once WA-2911 exposes the reduced state (its
   * `PolicyConfirmation.objects.active()` queryset) through the API.
   */
  private static readonly MAX_PAGES = 10;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async getPolicyGroups(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyGroup>> {
    const api = await this.transactionApiManager.getApi(args.chainId);

    const confirmations = await this.getAllPages({
      ...args,
      resource: 'policy-confirmations',
      fetchPage: (offset) =>
        api
          .getPolicyConfirmations({
            safeAddress: args.safeAddress,
            limit: PoliciesRepository.PAGE_SIZE,
            offset,
          })
          .then((page) => PolicyConfirmationPageSchema.parse(page)),
    });

    return policyGroups(confirmations);
  }

  public async getRootRequests(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<PolicyRootRequest>> {
    const api = await this.transactionApiManager.getApi(args.chainId);

    const rootRequests = await this.getAllPages({
      ...args,
      resource: 'policy-root-requests',
      fetchPage: (offset) =>
        api
          .getPolicyRootRequests({
            safeAddress: args.safeAddress,
            limit: PoliciesRepository.PAGE_SIZE,
            offset,
          })
          .then((page) => PolicyRootRequestPageSchema.parse(page)),
    });

    return rootRequests.sort(
      (first, second) => second.timestamp.getTime() - first.timestamp.getTime(),
    );
  }

  /**
   * Walks a paginated Transaction Service resource to exhaustion, bounded by
   * {@link MAX_PAGES}.
   */
  private async getAllPages<T>(args: {
    chainId: string;
    safeAddress: Address;
    resource: string;
    fetchPage: (offset: number) => Promise<Page<T>>;
  }): Promise<Array<T>> {
    const items: Array<T> = [];

    for (let page = 0; page < PoliciesRepository.MAX_PAGES; page++) {
      const { results, next } = await args.fetchPage(
        page * PoliciesRepository.PAGE_SIZE,
      );
      items.push(...results);

      if (!next) {
        return items;
      }
    }

    this.loggingService.warn({
      message: `Reached the policy page limit, ${args.resource} may be incomplete`,
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      maxItems: PoliciesRepository.MAX_PAGES * PoliciesRepository.PAGE_SIZE,
    });

    return items;
  }
}
