import { Page } from '../entities/page.entity';
import { Delegate } from './entities/delegate.entity';

export const IDelegateRepository = Symbol('IDelegateRepository');

export interface IDelegateRepository {
  getDelegates(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Delegate>>;

  postDelegate(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<unknown>;

  deleteDelegate(
    chainId: string,
    delegate: string,
    delegator: string,
    signature: string,
  ): Promise<unknown>;

  deleteSafeDelegate(
    chainId: string,
    delegate: string,
    safeAddress: string,
    signature: string,
  ): Promise<void>;
}
