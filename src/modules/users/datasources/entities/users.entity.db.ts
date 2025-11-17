import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  UserStatus,
  User as DomainUser,
} from '@/modules/users/domain/entities/user.entity';
import { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import { databaseEnumTransformer } from '@/domain/common/utils/enum';

@Entity('users')
export class User implements DomainUser {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_id' })
  id!: number;

  // Postgres enums are string therefore we use integer
  @Index('idx_user_status')
  @Column({
    type: 'integer',
    transformer: databaseEnumTransformer(UserStatus),
  })
  status!: keyof typeof UserStatus;

  @OneToMany(() => Wallet, (wallet: Wallet) => wallet.id, {
    onDelete: 'CASCADE',
  })
  wallets!: Array<Wallet>;

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

  @OneToMany(() => Member, (member: Member) => member.user)
  members!: Array<Member>;
}
