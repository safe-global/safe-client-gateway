// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { databaseEnumTransformer } from '#/domain/common/utils/enum';
import {
  type SpaceSetupRow as DomainSpaceSetupRow,
  SpaceSetupStatus,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';

@Entity('space_setups')
@Unique('UQ_space_setups_space_id', ['spaceId'])
export class SpaceSetup implements DomainSpaceSetupRow {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_space_setups_id' })
  id!: number;

  // FK_space_setups_space_id, ON DELETE CASCADE, lives in the migration.
  @Column({ name: 'space_id', type: 'integer', update: false })
  spaceId!: number;

  @Column({
    name: 'payment_link_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  paymentLinkId!: string | null;

  // JSON encrypted by KMS under the space-scoped context; plaintext JSON
  // while encryption is disabled.
  @Column({ type: 'text' })
  payload!: string;

  @Column({
    type: 'smallint',
    transformer: databaseEnumTransformer(SpaceSetupStatus),
  })
  status!: keyof typeof SpaceSetupStatus;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId!: UUID | null;

  @Column({
    name: 'applied_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  appliedAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    update: false,
  })
  updatedAt!: Date;
}
