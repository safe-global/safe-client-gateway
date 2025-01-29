import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  UserStatus,
  User as DomainUser,
} from '@/domain/users/entities/user.entity';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';

@Entity('users')
export class User implements DomainUser {
  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_id' })
  id!: number;

  @Index('idx_user_status')
  @Column({
    type: 'integer',
  })
  status!: UserStatus;

  @OneToMany(() => Wallet, (wallet) => wallet.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'wallet_id',
    foreignKeyConstraintName: 'FK_user_id_wallets',
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
}
