// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { SpaceAuditLog } from '@/modules/spaces/datasources/audit/entities/space-audit-log.entity.db';
import type {
  SpaceAuditEvent,
  SpaceAuditEventType,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

export type SpaceAuditRecordArgs = {
  spaceId: number;
  spaceUuid: UUID;
  actorUserId: number;
} & SpaceAuditEvent;

export type SpaceAuditFindArgs = {
  spaceId: number;
  limit: number;
  offset: number;
  eventTypes?: Array<keyof typeof SpaceAuditEventType>;
  actorUserId?: number;
  createdAtGte?: Date;
  createdAtLte?: Date;
  sortDirection?: 'asc' | 'desc';
};

export const ISpaceAuditRepository = Symbol('ISpaceAuditRepository');

export interface ISpaceAuditRepository {
  /**
   * Appends an audit event in the caller's transaction, so the event and the
   * mutation commit or roll back together. No-op when the feature flag is off.
   */
  record(
    entityManager: EntityManager,
    args: SpaceAuditRecordArgs,
  ): Promise<void>;

  /**
   * Returns a page of audit events plus the filtered total count, ordered by
   * `(created_at, id)` — the id tie-break keeps offset pagination stable for
   * same-timestamp rows.
   */
  findBySpaceId(
    args: SpaceAuditFindArgs,
  ): Promise<[Array<SpaceAuditLog>, number]>;

  /** Distinct actor user ids in a space's log, including former members. */
  findDistinctActorIds(spaceId: number): Promise<Array<number>>;
}
