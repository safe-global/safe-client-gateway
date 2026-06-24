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

  // Stored as `text` to hold AES-256-GCM ciphertext; plaintext length is
  // validated by the Zod schema (NAME_MAX_LENGTH) before encryption. Encryption
  // is performed in SpacesRepository under this space's per-space data key.
  @Column({ type: 'text' })
  name!: string;

  // KMS-wrapped per-space data key (`kdk:v1:<base64>`) that encrypts this space's
  // fields (and those of its members, address book, and audit log). Populated by
  // the repository on first encrypted write; null when encryption is disabled.
  @Column({
    name: 'encrypted_data_key',
    type: 'text',
    nullable: true,
  })
  encryptedDataKey?: string | null;

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
