// SPDX-License-Identifier: FSL-1.1-MIT
import type { EntityManager, ObjectLiteral, Repository } from 'typeorm';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';

/**
 * Repository for `entity`, bound to `entityManager`'s transaction when one is
 * passed, or a plain connection-level repository otherwise. Shared by
 * repositories that need to run inside either their own connection or a
 * caller's transaction.
 */
export async function getScopedRepository<T extends ObjectLiteral>(
  postgresDatabaseService: PostgresDatabaseService,
  entity: { new (): T },
  entityManager?: EntityManager,
): Promise<Repository<T>> {
  return entityManager
    ? entityManager.getRepository<T>(entity)
    : await postgresDatabaseService.getRepository<T>(entity);
}
