// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import {
  type Space as DomainSpace,
  SpaceStatus,
} from '@/modules/spaces/domain/entities/space.entity';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';

@Entity('spaces')
export class Space implements DomainSpace {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_spaces_id' })
  id!: number;

  @Column({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
    unique: true,
    nullable: false,
    update: false,
  })
  uuid!: UUID;

  // Encrypted directly by KMS under the space-scoped context (`kms:v1:`
  // ciphertext exceeds the plaintext cap, so the column is text; plaintext
  // length limits stay in the Zod DTOs). Encryption is performed in
  // SpacesRepository (two-phase: the id is DB-generated).
  @Column({ type: 'text' })
  name!: string;

  @Index('idx_space_status')
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(SpaceStatus),
  })
  status!: keyof typeof SpaceStatus;

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

  @OneToMany(
    () => Member,
    (member: Member) => member.space,
    {
      cascade: ['update', 'insert'],
    },
  )
  members!: Array<Member>;

  @OneToMany(
    () => SpaceSafe,
    (safeList: SpaceSafe) => safeList.space,
    {
      cascade: ['update', 'insert'],
    },
  )
  safes?: Array<SpaceSafe>;
}
