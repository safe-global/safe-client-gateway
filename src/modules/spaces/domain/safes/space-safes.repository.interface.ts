// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  EntityManager,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
} from 'typeorm';
import type { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { SpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository';

export const ISpaceSafesRepository = Symbol('ISpaceSafesRepository');

export interface ISpaceSafesRepository {
  /**
   * `assertSeats` is the caller's plan rule, applied to the Safe count taken
   * inside this method's transaction and under the space's lock — so it sees
   * the state the insert lands on, and concurrent additions cannot each pass a
   * stale count. Synchronous by contract: that critical section stays free of
   * I/O, so a caller resolves what it needs first (see
   * `IEntitlementEnforcement.prepareQuotaCheck`). Required, so a new caller
   * has to state which seat rule applies.
   */
  create(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
    assertSeats: (used: number) => void;
  }): Promise<void>;

  findBySpaceId(
    spaceId: Space['id'],
  ): Promise<Array<Pick<SpaceSafe, 'chainId' | 'address'>>>;

  findOrFail(
    args: Parameters<SpaceSafesRepository['find']>[0],
  ): Promise<Array<SpaceSafe>>;

  countBySpaceId(
    spaceId: Space['id'],
    entityManager?: EntityManager,
  ): Promise<number>;

  find(args: {
    where: Array<FindOptionsWhere<SpaceSafe>> | FindOptionsWhere<SpaceSafe>;
    select?: FindOptionsSelect<SpaceSafe>;
    relations?: FindOptionsRelations<SpaceSafe>;
  }): Promise<Array<SpaceSafe>>;

  delete(args: {
    spaceId: Space['id'];
    actorUserId: number;
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>;
  }): Promise<void>;
}
