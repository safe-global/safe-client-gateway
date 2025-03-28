import type { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import type { Space } from '@/datasources/spaces/entities/space.entity.db';
import type { SpaceSafesRepository } from '@/domain/spaces/space-safes.repository';
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

  findOrFail(
    args: Parameters<SpaceSafesRepository['find']>[0],
  ): Promise<Array<SpaceSafe>>;

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
