// SPDX-License-Identifier: FSL-1.1-MIT
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Address, Hex } from 'viem';
import { databaseAddressTransformer } from '#/domain/common/transformers/database-address.transformer';

/**
 * One entry of the `Configuration[]` behind a {@link PolicyConfigurationRequest},
 * stored exactly as it was hashed - `data` raw, never decoded.
 *
 * `position` is the entry's index in that array: the root is the hash of the
 * array in order, so reading the entries back in `position` order is what
 * reproduces it.
 *
 * Deleted with its request; immutable otherwise, like the request itself.
 */
@Entity('policy_configurations')
@Unique('UQ_PC_request_position', ['requestId', 'position'])
export class PolicyConfigurationRecord {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_PC_id',
  })
  public readonly id!: string;

  /** The `policy_configuration_requests.id` this entry belongs to. */
  @Column({ name: 'request_id', type: 'bigint', update: false })
  public readonly requestId!: string;

  @Column({ type: 'integer', update: false })
  public readonly position!: number;

  @Column({
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
    update: false,
  })
  public readonly target!: Address;

  @Column({ type: 'varchar', length: 10, update: false })
  public readonly selector!: Hex;

  /** `0` = CALL, `1` = DELEGATECALL, as the guard encodes it. */
  @Column({ type: 'smallint', update: false })
  public readonly operation!: 0 | 1;

  @Column({
    type: 'varchar',
    length: 42,
    transformer: databaseAddressTransformer,
    update: false,
  })
  public readonly policy!: Address;

  /** At most 64 KiB of bytes, enforced by `CHK_PC_data_size`. */
  @Column({ type: 'text', update: false })
  public readonly data!: Hex;
}
