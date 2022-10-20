import { NetworkResponse } from '../../datasources/network/entities/network.response.entity';
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

  postDelegates(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    signature?: string,
    label?: string,
  ): Promise<NetworkResponse<any>>;
}
