// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, getAddress } from 'viem';
import type { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import {
  IndexerMetaSchema,
  PolicyIndexerResponseSchema,
  type PolicyIndexerState,
} from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import {
  IndexerSafeAllowanceSchema,
  IndexerSafeDelegateSchema,
} from '@/modules/policies/domain/entities/indexer/safe-allowance.entity';
import { IndexerSafePolicySchema } from '@/modules/policies/domain/entities/indexer/safe-policy.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import type { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';

@Injectable()
export class PolicyIndexerRepository implements IPolicyIndexerRepository {
  constructor(
    private readonly policyIndexerApi: PolicyIndexerApi,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async getState(args: {
    safes: ReadonlyArray<SafeRef>;
  }): Promise<PolicyIndexerState> {
    const safes = this.checksum(args.safes);

    if (safes.length === 0) {
      return { meta: [], allowances: [], delegates: [], policies: [] };
    }

    const raw = await this.policyIndexerApi.getState({ safes });
    const response = PolicyIndexerResponseSchema.parse(raw);

    return {
      meta: this.parseRows(IndexerMetaSchema, response._meta, '_meta'),
      allowances: this.parseRows(
        IndexerSafeAllowanceSchema,
        response.SafeAllowance,
        'SafeAllowance',
      ),
      delegates: this.parseRows(
        IndexerSafeDelegateSchema,
        response.SafeDelegate,
        'SafeDelegate',
      ),
      policies: this.parseRows(
        IndexerSafePolicySchema,
        response.SafePolicy,
        'SafePolicy',
      ),
    };
  }

  public async clearState(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.policyIndexerApi.clearState(args);
  }

  /**
   * The indexer stores addresses checksummed, and a lower-cased address in a
   * filter matches nothing **and returns no error** - so normalising here is
   * what keeps a request from silently answering "this Safe has no policies".
   *
   * Duplicates are dropped: the same pair twice would widen the cache key for no
   * extra rows.
   */
  private checksum(safes: ReadonlyArray<SafeRef>): Array<SafeRef> {
    const unique = new Map<string, SafeRef>();

    for (const safe of safes) {
      const address = getAddress(safe.address);
      unique.set(`${safe.chainId}:${address}`, {
        chainId: safe.chainId,
        address,
      });
    }

    return [...unique.values()];
  }

  /**
   * Validates a root field's rows, dropping the ones it cannot read.
   *
   * Per-row leniency lives here rather than in the schema so the drop can be
   * logged: silently returning fewer policies than the indexer holds is the one
   * failure this whole path must not have.
   */
  private parseRows<T extends z.ZodType>(
    schema: T,
    rows: Array<unknown>,
    field: string,
  ): Array<z.infer<T>> {
    const parsed = rows.map((row) => schema.safeParse(row));
    const dropped = parsed.filter((result) => !result.success);

    if (dropped.length > 0) {
      this.loggingService.warn({
        message: 'Dropped unreadable policy indexer rows',
        field,
        dropped: dropped.length,
        of: rows.length,
        error: dropped[0].error?.message,
      });
    }

    return parsed.flatMap((result) => (result.success ? [result.data] : []));
  }
}
