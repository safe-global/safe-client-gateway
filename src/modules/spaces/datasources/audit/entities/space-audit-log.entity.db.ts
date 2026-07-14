// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';

/**
 * Append-only audit log of space mutations. Rows are immutable — the table
 * carries triggers that reject UPDATE/DELETE/TRUNCATE.
 */
@Entity('space_audit_log')
@Index('IDX_SAL_space_created_id', ['spaceId', 'createdAt', 'id'])
export class SpaceAuditLog {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_SAL_id',
  })
  id!: string;

  @Column({ name: 'space_id', type: 'integer', update: false })
  spaceId!: number;

  @Column({ name: 'space_uuid', type: 'uuid', update: false })
  spaceUuid!: UUID;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 64,
    update: false,
  })
  eventType!: keyof typeof SpaceAuditEventType;

  @Column({ name: 'actor_user_id', type: 'integer', update: false })
  actorUserId!: number;

  @Column({ type: 'text', update: false })
  payload!: string;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
    insert: false,
  })
  createdAt!: Date;
}
