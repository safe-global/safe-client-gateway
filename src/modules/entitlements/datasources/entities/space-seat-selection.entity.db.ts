// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { SpaceSeatSelection as DomainSpaceSeatSelection } from '@/modules/entitlements/domain/entities/space-seat-selection.entity';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';

// A workspace admin's explicit choice of which Safes keep the covered seats
// when the workspace is over-seat. Rows exist only once edited: the default
// coverage (oldest Safes first) is computed at read time, never stored.
// `created_at` doubles as the selection time (selections are replace-only).
@Entity('space_seat_selection')
export class SpaceSeatSelection implements DomainSpaceSeatSelection {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_SSSEL_id' })
  public readonly id!: number;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  public readonly createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  public readonly updatedAt!: Date;

  @Index('IDX_SSSEL_space_id')
  @ManyToOne(
    () => Space,
    (space: Space) => space.id,
    {
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({
    name: 'space_id',
    foreignKeyConstraintName: 'FK_SSSEL_space_id',
  })
  public readonly space?: Space;

  // Removing the Safe from the workspace clears its selection (CASCADE).
  @OneToOne(() => SpaceSafe, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'space_safe_id',
    foreignKeyConstraintName: 'FK_SSSEL_space_safe_id',
  })
  public readonly spaceSafe?: SpaceSafe;
}
