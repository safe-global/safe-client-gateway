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
} from '@/domain/users/entities/user.entity';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { UserOrganization } from '@/datasources/users/entities/user-organizations.entity.db';

@Entity('users')
export class User implements DomainUser {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_id' })
  id!: number;

  // Postgres enums are string therefore we use integer
  @Index('idx_user_status')
  @Column({
    type: 'integer',
  })
  status!: UserStatus;

  @OneToMany(() => Wallet, (wallet: Wallet) => wallet.id, {
    onDelete: 'CASCADE',
  })
  wallets!: Array<Wallet>;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;

  @OneToMany(
    () => UserOrganization,
    (userOrganization: UserOrganization) => userOrganization.user,
  )
  userOrganizations!: Array<UserOrganization>;
}
