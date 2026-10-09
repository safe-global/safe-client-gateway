// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import type { ISafePolicyGuardRepository } from '@/modules/policies/domain/safe-policy-guard.repository.interface';

@Injectable()
export class SafePolicyGuardRepository implements ISafePolicyGuardRepository {
  public getExpiry(_args: {
    chainId: string;
    guard: Address;
  }): Promise<number> {
    // Placeholder: replaced in step 8. EXPIRY is not read from the chain yet,
    // so every root is treated as never expiring.
    return Promise.resolve(Number.MAX_SAFE_INTEGER);
  }
}
