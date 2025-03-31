import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  SpaceStatus,
  Space as DomainSpace,
} from '@/domain/spaces/entities/space.entity';
import { Member } from '@/datasources/users/entities/member.entity.db';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';
import { SpaceSafe } from '@/datasources/spaces/entities/space-safes.entity.db';
import { NAME_MAX_LENGTH } from '@/domain/common/entities/name.schema';

@Entity('spaces')
export class Space implements DomainSpace {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_spaces_id' })
  id!: number;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
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

  @OneToMany(() => Member, (member: Member) => member.space, {
    cascade: ['update', 'insert'],
  })
  members!: Array<Member>;

  @OneToMany(() => SpaceSafe, (safeList: SpaceSafe) => safeList.space, {
    cascade: ['update', 'insert'],
  })
  safes?: Array<SpaceSafe>;
}
