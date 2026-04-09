// SPDX-License-Identifier: FSL-1.1-MIT
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Address } from 'viem';

export const IDelegatesV2Repository = Symbol('IDelegatesV2Repository');

export interface IDelegatesV2Repository {
  getDelegates(args: {
    chainId: string;
    safeAddress?: string;
    delegate?: string;
    delegator?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<Delegate>>;

  clearDelegates(args: {
    chainId: string;
    safeAddress?: string;
  }): Promise<void>;

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
    safeAddress: Address | null;
    signature: string;
  }): Promise<unknown>;
}
