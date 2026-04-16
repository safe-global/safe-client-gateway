// SPDX-License-Identifier: FSL-1.1-MIT
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import type { User } from '@/modules/users/datasources/entities/users.entity.db';
import type { CounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository';
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';

export const ICounterfactualSafesRepository = Symbol(
  'ICounterfactualSafesRepository',
);

export interface ICounterfactualSafesRepository {
  create(args: {
    creatorId: User['id'] | null;
    payload: Array<
      Pick<
        CounterfactualSafe,
        | 'chainId'
        | 'address'
        | 'factoryAddress'
        | 'masterCopy'
        | 'saltNonce'
        | 'safeVersion'
        | 'threshold'
        | 'owners'
        | 'fallbackHandler'
        | 'setupTo'
        | 'setupData'
        | 'paymentToken'
        | 'payment'
        | 'paymentReceiver'
      >
    >;
  }): Promise<void>;

  findByCreatorId(args: {
    creatorId: User['id'];
  }): Promise<Array<CounterfactualSafe>>;

  findOrFail(
    args: Parameters<CounterfactualSafesRepository['find']>[0],
  ): Promise<Array<CounterfactualSafe>>;

  find(args: {
    where:
      | Array<FindOptionsWhere<CounterfactualSafe>>
      | FindOptionsWhere<CounterfactualSafe>;
    select?: FindOptionsSelect<CounterfactualSafe>;
    relations?: FindOptionsRelations<CounterfactualSafe>;
  }): Promise<Array<CounterfactualSafe>>;

  delete(args: {
    creatorId: User['id'];
    payload: Array<{
      chainId: CounterfactualSafe['chainId'];
      address: CounterfactualSafe['address'];
    }>;
  }): Promise<void>;
}
