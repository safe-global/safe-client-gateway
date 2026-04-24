// SPDX-License-Identifier: FSL-1.1-MIT
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { OffchainDelegate } from '@/modules/offchain/entities/delegate.entity';

/**
 * Maps a queue service OffchainDelegate to the domain delegate shape,
 * preserving the nullable label from the upstream response.
 */
export function mapOffchainToDelegate(d: OffchainDelegate): Delegate {
  return {
    ...d,
    label: d.label ?? '',
  };
}
