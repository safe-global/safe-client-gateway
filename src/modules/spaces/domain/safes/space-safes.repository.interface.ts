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

/**
 * A Safe ready to insert: encrypted address, its blind index, and the
 * plaintext the audit event needs. Produced by `encryptRows` and consumed by
 * `insertRows`; nothing else reads its fields.
 */
export type PreparedSpaceSafe = {
  space: { id: Space['id'] };
  chainId: SpaceSafe['chainId'];
  address: SpaceSafe['address'];
  addressIndex: string | null;
  plaintextAddress: SpaceSafe['address'];
};

export interface ISpaceSafesRepository {
  /**
   * Ciphertext, blind index and the plaintext the audit event records, for
   * rows that are not inserted yet. Only `insertRows` reads inside it; a
   * caller carries it from one step to the next.
   */
  encryptRows(
    spaceId: Space['id'],
    payload: Array<{
      chainId: SpaceSafe['chainId'];
      address: SpaceSafe['address'];
    }>,
  ): Promise<Array<PreparedSpaceSafe>>;

  /**
   * Transaction-scoped Postgres lock serializing seat changes for a space,
   * released when `entityManager`'s transaction ends. A caller that admits
   * Safes against a seat count takes it first, so the count it reads is the
   * state its insert lands on; otherwise concurrent additions each pass a
   * stale count and overshoot a quota together.
   */
  lockSeats(spaceId: Space['id'], entityManager: EntityManager): Promise<void>;

  /**
   * Inserts prepared rows and records the audit event, both in the caller's
   * transaction. Encrypting beforehand is what keeps its KMS round-trips out
   * of that transaction and out of {@link lockSeats}'s critical section.
   */
  insertRows(args: {
    spaceId: Space['id'];
    actorUserId: number;
    rows: Array<PreparedSpaceSafe>;
    entityManager: EntityManager;
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
