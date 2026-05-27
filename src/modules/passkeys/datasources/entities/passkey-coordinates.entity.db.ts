// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { databaseBufferTransformer } from '@/domain/common/transformers/databaseBuffer.transformer';

@Entity('passkey_coordinates')
@Unique('UQ_PC_credential_id', ['credentialId'])
export class PasskeyCoordinates {
  @PrimaryGeneratedColumn({
    name: 'id',
    type: 'integer',
    primaryKeyConstraintName: 'PK_passkey_coordinates',
  })
  id!: number;

  @Column({
    name: 'credential_id',
    type: 'bytea',
    transformer: databaseBufferTransformer,
  })
  credentialId!: Buffer;

  @Column({ type: 'bytea', transformer: databaseBufferTransformer })
  x!: Buffer;

  @Column({ type: 'bytea', transformer: databaseBufferTransformer })
  y!: Buffer;

  @Column({ type: 'bytea', transformer: databaseBufferTransformer })
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
