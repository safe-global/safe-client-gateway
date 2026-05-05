// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('passkey_coordinates')
export class PasskeyCoordinates {
  @PrimaryColumn({
    name: 'credential_id',
    type: 'bytea',
    primaryKeyConstraintName: 'PK_passkey_coordinates',
  })
  credentialId!: Buffer;

  @Column({ type: 'bytea' })
  x!: Buffer;

  @Column({ type: 'bytea' })
  y!: Buffer;

  @Column({ type: 'bytea' })
  verifiers!: Buffer;

  @Column({ name: 'rp_id', type: 'text' })
  rpId!: string;

  @Column({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'now()',
    update: false,
  })
  createdAt!: Date;
}
