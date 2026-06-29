// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The per-user TOTP registration: one row per user, holding the shared TOTP
 * secret used to verify codes. The presence of a row means the user is
 * enrolled. `user_id` is the primary key and a foreign key to `users` (see the
 * migration for the FK).
 *
 * This is the ONLY persistent state the feature adds. The per-action elevation
 * is a short-lived self-contained JWT, so it needs no row here.
 */
@Entity('user_totp')
export class UserTotp {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar' })
  secret!: string;
}
