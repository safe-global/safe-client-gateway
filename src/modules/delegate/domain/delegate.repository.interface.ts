// SPDX-License-Identifier: FSL-1.1-MIT
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Address } from 'viem';

export const IDelegateRepository = Symbol('IDelegateRepository');

export interface IDelegateRepository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: Address;
    delegate?: Address;
    delegator?: Address;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  postDelegate(args: {
    chainId: string;
    safeAddress: Address | null;
    delegate: Address;
    delegator: Address;
    signature: string;
    label: string;
  }): Promise<void>;

  deleteDelegate(args: {
    chainId: string;
    delegate: Address;
    delegator: Address;
    signature: string;
  }): Promise<unknown>;

  deleteSafeDelegate(args: {
    chainId: string;
    delegate: Address;
    safeAddress: Address;
    signature: string;
  }): Promise<unknown>;
}
