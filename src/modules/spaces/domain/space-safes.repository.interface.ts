// SPDX-License-Identifier: FSL-1.1-MIT
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type {
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';

export const ISpaceSafesRepository = Symbol('ISpaceSafesRepository');

export interface ISpaceSafesRepository {
  create(args: {
    spaceId: Space['id'];
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void>;

  findBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<Pick<SpaceSafe, 'chainId' | 'address'>>>;

  findOrFail(args: {
    where: Array<FindOptionsWhere<SpaceSafe>> | FindOptionsWhere<SpaceSafe>;
    select?: FindOptionsSelect<SpaceSafe>;
    relations?: FindOptionsRelations<SpaceSafe>;
  }): Promise<Array<SpaceSafe>>;

  find(args: {
    where: Array<FindOptionsWhere<SpaceSafe>> | FindOptionsWhere<SpaceSafe>;
    select?: FindOptionsSelect<SpaceSafe>;
    relations?: FindOptionsRelations<SpaceSafe>;
  }): Promise<Array<SpaceSafe>>;

  delete(args: {
    spaceId: Space['id'];
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void>;
}
