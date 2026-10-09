// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { z } from 'zod';
import { SafePolicyGuardApi } from '@/modules/policies/datasources/safe-policy-guard-api.service';
import type { ISafePolicyGuardRepository } from '@/modules/policies/domain/safe-policy-guard.repository.interface';

/**
 * `EXPIRY` in seconds. Rejected rather than rounded if it does not fit in a
 * safe integer: a rounded expiry would move every root's deadline.
 */
const ExpirySecondsSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine(Number.isSafeInteger, {
    error: 'Expected an expiry within the safe integer range',
  });

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

    return ExpirySecondsSchema.parse(expiry);
  }
}
