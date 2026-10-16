// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { SafePolicyGuardApi } from '#/modules/policies/datasources/safe-policy-guard-api.service';
import { PolicyIndexerIntegerSchema } from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { ISafePolicyGuardRepository } from '#/modules/policies/domain/safe-policy-guard.repository.interface';

@Injectable()
export class SafePolicyGuardRepository implements ISafePolicyGuardRepository {
  constructor(
    @Inject(SafePolicyGuardApi)
    private readonly safePolicyGuardApi: SafePolicyGuardApi,
  ) {}

  public async getExpiry(args: {
    chainId: string;
    guard: Address;
  }): Promise<number> {
    const expiry = await this.safePolicyGuardApi.getExpiry(args);

    return PolicyIndexerIntegerSchema.parse(expiry);
  }

  public async getDelay(args: {
    chainId: string;
    guard: Address;
  }): Promise<number> {
    const delay = await this.safePolicyGuardApi.getDelay(args);

    return PolicyIndexerIntegerSchema.parse(delay);
  }
}
